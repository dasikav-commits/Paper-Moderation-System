import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { encryptPdfBuffer, encryptWordBuffer } from '@/lib/encryption';
import { generateSamplePdfBuffer, generateSampleWordBuffer } from '@/lib/sampleDocs';
import path from 'node:path';
import fs from 'node:fs/promises';

const normalizeDept = (d: string) =>
  d.toLowerCase().replace(/and/g, '&').replace(/\s+/g, ' ').trim();

async function checkAccess(paper: any, userId: string | null) {
  if (!userId) return { allowed: false, reason: 'Authentication required.' };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'User not found.' };

  const isHodOfDept =
    user.role === 'DEPARTMENT_HEAD' &&
    normalizeDept(user.department || '') === normalizeDept(paper.subject.department || '');

  const isSubjectModerator = paper.subject.moderatorId === user.id;
  const isFirstExaminer =
    (paper.subject.firstExaminerId || paper.subject.lecturerId || paper.lecturerId) === user.id;

  if (!isHodOfDept && !isSubjectModerator && !isFirstExaminer) {
    return {
      allowed: false,
      reason:
        'Only the Head of Department (HOD) and assigned Moderator are authorized to access password-protected finalized files.',
    };
  }

  return { allowed: true, user, isHodOfDept, isSubjectModerator };
}

async function resolveDocumentBuffer(
  url: string,
  paper: any,
  kind: 'paper' | 'scheme',
  format: 'pdf' | 'word'
): Promise<Buffer> {
  if (url.startsWith('/api/sample-files')) {
    const opts = {
      code: paper.subject.code,
      title: paper.subject.name,
      department: paper.subject.department || 'Faculty of Applied Sciences',
      academicYear: paper.academicYear,
      semester: paper.semester,
      kind,
      version: 'final' as const,
      examinerName:
        paper.subject.firstExaminer?.name || paper.lecturer?.name || 'First Examiner',
    };
    return format === 'pdf'
      ? generateSamplePdfBuffer(opts)
      : generateSampleWordBuffer(opts);
  }

  if (url.startsWith('/uploads/')) {
    const safeRel = url.replace(/^\/+/, '');
    const fullPath = path.join(process.cwd(), 'public', safeRel);
    return fs.readFile(fullPath);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Unable to fetch source document (${resp.status})`);
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  throw new Error('Document file URL is unavailable');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        subject: { include: { firstExaminer: true, lecturer: true, moderator: true } },
        lecturer: true,
      },
    });

    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const access = await checkAccess(paper, userId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const effectivePassword =
      paper.filePassword ||
      `WUSL-${paper.subject.code.replace(/\s+/g, '')}-${paper.semester}`;

    return NextResponse.json({
      authorized: true,
      filePassword: effectivePassword,
      hasPaperPdf: Boolean(paper.paperUrl),
      hasPaperWord: Boolean(paper.paperWordUrl),
      hasSchemePdf: Boolean(paper.markingSchemeUrl),
      hasSchemeWord: Boolean(paper.markingSchemeWordUrl),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const body = await request.json();
    const { userId, password, fileType, mode } = body as {
      userId: string;
      password: string;
      fileType: 'paperPdf' | 'paperWord' | 'schemePdf' | 'schemeWord';
      mode?: 'encrypted' | 'unlocked';
    };

    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        subject: { include: { firstExaminer: true, lecturer: true, moderator: true } },
        lecturer: true,
      },
    });

    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const access = await checkAccess(paper, userId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const expectedPassword =
      paper.filePassword ||
      `WUSL-${paper.subject.code.replace(/\s+/g, '')}-${paper.semester}`;

    if (!password || String(password).trim() !== expectedPassword) {
      return NextResponse.json(
        { error: 'Invalid file protection password. Access denied.' },
        { status: 401 }
      );
    }

    const isPdf = fileType === 'paperPdf' || fileType === 'schemePdf';
    const isPaper = fileType === 'paperPdf' || fileType === 'paperWord';

    let targetUrl =
      fileType === 'paperPdf'
        ? paper.paperUrl
        : fileType === 'paperWord'
        ? paper.paperWordUrl
        : fileType === 'schemePdf'
        ? paper.markingSchemeUrl
        : paper.markingSchemeWordUrl;

    // Graceful fallback to dynamically generated official Final document if legacy record lacked Word slot
    if (!targetUrl) {
      targetUrl = `/api/sample-files?code=${encodeURIComponent(paper.subject.code)}&kind=${
        isPaper ? 'paper' : 'scheme'
      }&format=${isPdf ? 'pdf' : 'docx'}&version=final`;
    }

    const rawBuffer = await resolveDocumentBuffer(
      targetUrl,
      paper,
      isPaper ? 'paper' : 'scheme',
      isPdf ? 'pdf' : 'word'
    );

    const outputBuffer =
      mode === 'unlocked'
        ? rawBuffer
        : isPdf
        ? await encryptPdfBuffer(rawBuffer, expectedPassword)
        : await encryptWordBuffer(rawBuffer, expectedPassword);

    const safeCode = paper.subject.code.replace(/\s+/g, '_');
    const docLabel = isPaper ? 'Final_Paper' : 'Final_Marking_Scheme';
    const ext = isPdf ? 'pdf' : 'docx';
    const prefix = mode === 'unlocked' ? 'Unlocked' : 'Protected';
    const fileName = `${prefix}_${safeCode}_${docLabel}.${ext}`;

    const contentType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new Response(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${
          mode === 'unlocked' ? 'inline' : 'attachment'
        }; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
