import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

function dbStatusToClient(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'UNDER_MODERATION':
      return 'under_moderation';
    case 'REVISION_REQUIRED':
      return 'revision_required';
    case 'FINALIZED':
      return 'finalized';
    default:
      return 'draft';
  }
}

function clientStatusToDb(status: string): string {
  switch (status.toLowerCase()) {
    case 'draft':
      return 'DRAFT';
    case 'submitted':
    case 'under_moderation':
      return 'UNDER_MODERATION';
    case 'revision_required':
      return 'REVISION_REQUIRED';
    case 'finalized':
      return 'FINALIZED';
    default:
      return 'DRAFT';
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;

    if (id.startsWith('virtual-')) {
      const subjectId = id.replace('virtual-', '');
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { firstExaminer: true, lecturer: true, moderator: true },
      });

      if (!subject) {
        return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
      }

      const effectiveFirstId = subject.firstExaminerId || subject.lecturerId || '';
      const effectiveFirstName =
        subject.firstExaminer?.name || subject.lecturer?.name || '';

      return NextResponse.json({
        id: `virtual-${subject.id}`,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        department: subject.department || '',
        firstExaminerId: effectiveFirstId,
        firstExaminerName: effectiveFirstName,
        lecturerId: effectiveFirstId,
        lecturerName: effectiveFirstName,
        moderatorId: subject.moderatorId || '',
        moderatorName: subject.moderator?.name || '',
        academicYear: subject.academicYear,
        semester: subject.semester,
        status: 'draft',
        hasPasswordProtection: false,
        sentToHod: false,
        createdAt: subject.createdAt.toISOString(),
        updatedAt: subject.updatedAt.toISOString(),
      });
    }

    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        subject: {
          include: {
            firstExaminer: true,
            lecturer: true,
            moderator: true,
          },
        },
        lecturer: true,
        moderationReport: { select: { id: true } },
      },
    });

    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const effectiveFirstId =
      paper.subject.firstExaminerId || paper.subject.lecturerId || paper.lecturerId;
    const effectiveFirstName =
      paper.subject.firstExaminer?.name ||
      paper.subject.lecturer?.name ||
      paper.lecturer.name;

    return NextResponse.json({
      id: paper.id,
      subjectId: paper.subjectId,
      subjectCode: paper.subject.code,
      subjectName: paper.subject.name,
      department: paper.subject.department || '',
      firstExaminerId: effectiveFirstId,
      firstExaminerName: effectiveFirstName,
      lecturerId: paper.lecturerId,
      lecturerName: paper.lecturer.name,
      moderatorId: paper.subject.moderatorId || '',
      moderatorName: paper.subject.moderator?.name || '',
      academicYear: paper.academicYear,
      semester: paper.semester,
      status: dbStatusToClient(paper.status),
      paperUrl: paper.paperUrl || undefined,
      paperWordUrl: paper.paperWordUrl || undefined,
      markingSchemeUrl: paper.markingSchemeUrl || undefined,
      markingSchemeWordUrl: paper.markingSchemeWordUrl || undefined,
      draftPaperUrl: paper.draftPaperUrl || paper.paperUrl || undefined,
      draftPaperWordUrl: paper.draftPaperWordUrl || paper.paperWordUrl || undefined,
      draftMarkingSchemeUrl:
        paper.draftMarkingSchemeUrl || paper.markingSchemeUrl || undefined,
      draftMarkingSchemeWordUrl:
        paper.draftMarkingSchemeWordUrl || paper.markingSchemeWordUrl || undefined,
      hasPasswordProtection: Boolean(paper.filePassword),
      sentToHod: Boolean(paper.sentToHod),
      sentToHodAt: paper.sentToHodAt ? paper.sentToHodAt.toISOString() : undefined,
      hasReport: Boolean(paper.moderationReport),
      createdAt: paper.createdAt.toISOString(),
      updatedAt: paper.updatedAt.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      paperUrl,
      paperWordUrl,
      markingSchemeUrl,
      markingSchemeWordUrl,
      filePassword,
      actingUserId,
    } = body;

    const existing = await prisma.paper.findUnique({
      where: { id },
      include: { subject: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const dbNextStatus = status !== undefined ? clientStatusToDb(status) : existing.status;

    // Enforce First Examiner permission when uploading drafts or finalizing
    if (
      actingUserId &&
      (dbNextStatus === 'UNDER_MODERATION' || dbNextStatus === 'FINALIZED')
    ) {
      const designatedSetter =
        existing.subject.firstExaminerId || existing.subject.lecturerId || existing.lecturerId;
      if (designatedSetter && designatedSetter !== actingUserId) {
        return NextResponse.json(
          {
            error:
              'Only the assigned First Examiner is authorized to upload or finalize this paper.',
          },
          { status: 403 }
        );
      }
    }

    const data: any = {};
    if (status !== undefined) data.status = dbNextStatus as any;
    if (paperUrl !== undefined) data.paperUrl = paperUrl;
    if (paperWordUrl !== undefined) data.paperWordUrl = paperWordUrl;
    if (markingSchemeUrl !== undefined) data.markingSchemeUrl = markingSchemeUrl;
    if (markingSchemeWordUrl !== undefined) data.markingSchemeWordUrl = markingSchemeWordUrl;

    if (dbNextStatus === 'UNDER_MODERATION') {
      if (paperUrl !== undefined) data.draftPaperUrl = paperUrl;
      if (paperWordUrl !== undefined) data.draftPaperWordUrl = paperWordUrl;
      if (markingSchemeUrl !== undefined) data.draftMarkingSchemeUrl = markingSchemeUrl;
      if (markingSchemeWordUrl !== undefined)
        data.draftMarkingSchemeWordUrl = markingSchemeWordUrl;
    }

    if (dbNextStatus === 'FINALIZED') {
      // Preserve draft links before replacing primary URLs with final versions
      if (!existing.draftPaperUrl && existing.paperUrl) {
        data.draftPaperUrl = existing.paperUrl;
      }
      if (!existing.draftPaperWordUrl && existing.paperWordUrl) {
        data.draftPaperWordUrl = existing.paperWordUrl;
      }
      if (!existing.draftMarkingSchemeUrl && existing.markingSchemeUrl) {
        data.draftMarkingSchemeUrl = existing.markingSchemeUrl;
      }
      if (!existing.draftMarkingSchemeWordUrl && existing.markingSchemeWordUrl) {
        data.draftMarkingSchemeWordUrl = existing.markingSchemeWordUrl;
      }

      if (filePassword !== undefined) {
        data.filePassword = String(filePassword);
      }
      data.sentToHod = true;
      data.sentToHodAt = new Date();
    }

    const updatedPaper = await prisma.paper.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedPaper);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
