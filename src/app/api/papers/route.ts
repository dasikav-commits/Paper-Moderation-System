import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const normalizeDept = (d: string) =>
  d.toLowerCase().replace(/and/g, '&').replace(/\s+/g, ' ').trim();

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

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');
    const moderatorId = searchParams.get('moderatorId');
    const department = searchParams.get('department');

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const dbPapers = await prisma.paper.findMany({
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
      orderBy: { updatedAt: 'desc' },
    });

    const filteredDbPapers = department
      ? dbPapers.filter(
          (p) => normalizeDept(p.subject.department || '') === normalizeDept(department)
        )
      : dbPapers;

    const mapPaper = (p: any) => {
      const effectiveFirstExaminerId =
        p.subject.firstExaminerId || p.subject.lecturerId || p.lecturerId;
      const effectiveFirstExaminerName =
        p.subject.firstExaminer?.name || p.subject.lecturer?.name || p.lecturer?.name || '';
      const rawLecIds: string[] = Array.isArray(p.subject.lecturerIds)
        ? p.subject.lecturerIds.filter(Boolean)
        : [p.subject.lecturerId, p.subject.firstExaminerId].filter(Boolean);
      const uniqueLecIds = Array.from(new Set(rawLecIds));
      const lecturers = uniqueLecIds.map((id) => userMap.get(id)).filter(Boolean);

      return {
        id: p.id,
        subjectId: p.subjectId,
        subjectCode: p.subject.code,
        subjectName: p.subject.name,
        department: p.subject.department || '',
        firstExaminerId: effectiveFirstExaminerId,
        firstExaminerName: effectiveFirstExaminerName,
        lecturerId: p.lecturerId,
        lecturerName: p.lecturer?.name || effectiveFirstExaminerName,
        lecturerIds: uniqueLecIds,
        lecturers,
        moderatorId: p.subject.moderatorId || '',
        moderatorName: p.subject.moderator?.name || '',
        academicYear: p.academicYear,
        semester: p.semester,
        status: dbStatusToClient(p.status),
        paperUrl: p.paperUrl || undefined,
        paperWordUrl: p.paperWordUrl || undefined,
        markingSchemeUrl: p.markingSchemeUrl || undefined,
        markingSchemeWordUrl: p.markingSchemeWordUrl || undefined,
        draftPaperUrl: p.draftPaperUrl || p.paperUrl || undefined,
        draftPaperWordUrl: p.draftPaperWordUrl || p.paperWordUrl || undefined,
        draftMarkingSchemeUrl: p.draftMarkingSchemeUrl || p.markingSchemeUrl || undefined,
        draftMarkingSchemeWordUrl:
          p.draftMarkingSchemeWordUrl || p.markingSchemeWordUrl || undefined,
        hasPasswordProtection: Boolean(p.filePassword),
        sentToHod: Boolean(p.sentToHod),
        sentToHodAt: p.sentToHodAt ? p.sentToHodAt.toISOString() : undefined,
        hasReport: Boolean(p.moderationReport),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    };

    const clientPapers = filteredDbPapers.map(mapPaper);

    // Lecturer view: return all subjects where user is First Examiner OR Assigned Lecturer
    if (lecturerId) {
      const allSubjects = await prisma.subject.findMany({
        include: {
          firstExaminer: true,
          lecturer: true,
          moderator: true,
          papers: true,
        },
        orderBy: { code: 'asc' },
      });

      const mySubjects = allSubjects.filter((s) => {
        const ids: string[] = Array.isArray(s.lecturerIds) ? (s.lecturerIds as string[]) : [];
        return (
          s.firstExaminerId === lecturerId ||
          s.lecturerId === lecturerId ||
          ids.includes(lecturerId)
        );
      });

      const mySubjectIds = new Set(mySubjects.map((s) => s.id));
      const result = clientPapers
        .filter((p) => mySubjectIds.has(p.subjectId) || p.lecturerId === lecturerId)
        .map((p) => ({
          ...p,
          isFirstExaminer: p.firstExaminerId === lecturerId,
        }));

      for (const subject of mySubjects) {
        const alreadyListed = result.some((p) => p.subjectId === subject.id);
        if (!alreadyListed) {
          const effectiveFirstId = subject.firstExaminerId || subject.lecturerId || '';
          const rawIds: string[] = Array.isArray(subject.lecturerIds)
            ? (subject.lecturerIds as string[]).filter(Boolean)
            : [subject.lecturerId, subject.firstExaminerId].filter(Boolean) as string[];
          const uniqueIds = Array.from(new Set(rawIds));

          result.push({
            id: `virtual-${subject.id}`,
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            department: subject.department || '',
            firstExaminerId: effectiveFirstId,
            firstExaminerName:
              subject.firstExaminer?.name || subject.lecturer?.name || 'Unassigned',
            lecturerId: effectiveFirstId,
            lecturerName:
              subject.firstExaminer?.name || subject.lecturer?.name || 'Unassigned',
            lecturerIds: uniqueIds,
            lecturers: uniqueIds.map((id) => userMap.get(id)).filter(Boolean),
            moderatorId: subject.moderatorId || '',
            moderatorName: subject.moderator?.name || 'Unassigned',
            academicYear: subject.academicYear,
            semester: subject.semester,
            status: 'draft',
            paperUrl: undefined,
            paperWordUrl: undefined,
            markingSchemeUrl: undefined,
            markingSchemeWordUrl: undefined,
            draftPaperUrl: undefined,
            draftPaperWordUrl: undefined,
            draftMarkingSchemeUrl: undefined,
            draftMarkingSchemeWordUrl: undefined,
            hasPasswordProtection: false,
            sentToHod: false,
            sentToHodAt: undefined,
            hasReport: false,
            isFirstExaminer: effectiveFirstId === lecturerId,
            createdAt: subject.createdAt.toISOString(),
            updatedAt: subject.updatedAt.toISOString(),
          });
        }
      }

      return NextResponse.json(result);
    }

    // Moderator view: return ALL subjects assigned to this Moderator (including virtual pending ones)
    if (moderatorId) {
      const modSubjects = await prisma.subject.findMany({
        where: { moderatorId },
        include: {
          firstExaminer: true,
          lecturer: true,
          moderator: true,
        },
        orderBy: { code: 'asc' },
      });

      const modSubjectIds = new Set(modSubjects.map((s) => s.id));
      const result = clientPapers.filter((p) => modSubjectIds.has(p.subjectId));

      for (const subject of modSubjects) {
        const alreadyListed = result.some((p) => p.subjectId === subject.id);
        if (!alreadyListed) {
          const effectiveFirstId = subject.firstExaminerId || subject.lecturerId || '';
          const rawIds: string[] = Array.isArray(subject.lecturerIds)
            ? (subject.lecturerIds as string[]).filter(Boolean)
            : [subject.lecturerId, subject.firstExaminerId].filter(Boolean) as string[];
          const uniqueIds = Array.from(new Set(rawIds));

          result.push({
            id: `virtual-${subject.id}`,
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            department: subject.department || '',
            firstExaminerId: effectiveFirstId,
            firstExaminerName:
              subject.firstExaminer?.name || subject.lecturer?.name || 'Unassigned',
            lecturerId: effectiveFirstId,
            lecturerName:
              subject.firstExaminer?.name || subject.lecturer?.name || 'Unassigned',
            lecturerIds: uniqueIds,
            lecturers: uniqueIds.map((id) => userMap.get(id)).filter(Boolean),
            moderatorId: subject.moderatorId || '',
            moderatorName: subject.moderator?.name || '',
            academicYear: subject.academicYear,
            semester: subject.semester,
            status: 'draft',
            paperUrl: undefined,
            paperWordUrl: undefined,
            markingSchemeUrl: undefined,
            markingSchemeWordUrl: undefined,
            draftPaperUrl: undefined,
            draftPaperWordUrl: undefined,
            draftMarkingSchemeUrl: undefined,
            draftMarkingSchemeWordUrl: undefined,
            hasPasswordProtection: false,
            sentToHod: false,
            sentToHodAt: undefined,
            hasReport: false,
            createdAt: subject.createdAt.toISOString(),
            updatedAt: subject.updatedAt.toISOString(),
          });
        }
      }

      return NextResponse.json(result);
    }

    return NextResponse.json(clientPapers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const {
      subjectId,
      lecturerId,
      academicYear,
      semester,
      status,
      paperUrl,
      paperWordUrl,
      markingSchemeUrl,
      markingSchemeWordUrl,
    } = body;

    if (!subjectId || !lecturerId) {
      return NextResponse.json(
        { error: 'Subject ID and First Examiner ID are required' },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const designatedSetterId = subject.firstExaminerId || subject.lecturerId;
    if (designatedSetterId && designatedSetterId !== lecturerId) {
      return NextResponse.json(
        {
          error:
            'Only the assigned First Examiner is authorized to set and upload the examination paper for this subject.',
        },
        { status: 403 }
      );
    }

    const newPaper = await prisma.paper.create({
      data: {
        subjectId,
        lecturerId,
        academicYear: academicYear || subject.academicYear || '2025/2026',
        semester: Number(semester) || subject.semester || 1,
        status: clientStatusToDb(status || 'DRAFT') as any,
        paperUrl: paperUrl || null,
        paperWordUrl: paperWordUrl || null,
        markingSchemeUrl: markingSchemeUrl || null,
        markingSchemeWordUrl: markingSchemeWordUrl || null,
        draftPaperUrl: paperUrl || null,
        draftPaperWordUrl: paperWordUrl || null,
        draftMarkingSchemeUrl: markingSchemeUrl || null,
        draftMarkingSchemeWordUrl: markingSchemeWordUrl || null,
      },
    });

    return NextResponse.json(newPaper, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
