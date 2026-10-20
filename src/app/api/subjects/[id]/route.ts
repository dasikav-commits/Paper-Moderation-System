import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { enrichSubjects } from '../route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        firstExaminer: true,
        lecturer: true,
        moderator: true,
        papers: {
          include: { moderationReport: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const [enriched] = await enrichSubjects([subject]);
    return NextResponse.json(enriched);
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
      code,
      name,
      academicYear,
      semester,
      firstExaminerId,
      lecturerId,
      lecturerIds,
      moderatorId,
      assignedByUserId,
    } = body;

    if (assignedByUserId) {
      const actor = await prisma.user.findUnique({ where: { id: assignedByUserId } });
      if (!actor || actor.role !== 'DEPARTMENT_HEAD') {
        return NextResponse.json(
          { error: 'Only the Head of Department (HOD) can assign lecturers and examiners.' },
          { status: 403 }
        );
      }
    }

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const nextFirstExaminerId =
      firstExaminerId !== undefined
        ? firstExaminerId || null
        : lecturerId !== undefined && existing.firstExaminerId === null
        ? lecturerId || null
        : existing.firstExaminerId;

    const nextModeratorId =
      moderatorId !== undefined ? moderatorId || null : existing.moderatorId;

    if (nextFirstExaminerId && nextModeratorId && nextFirstExaminerId === nextModeratorId) {
      return NextResponse.json(
        { error: 'First Examiner and Moderator cannot be the same staff member.' },
        { status: 400 }
      );
    }

    let nextLecturerIds: string[] | undefined = undefined;
    if (lecturerIds !== undefined) {
      nextLecturerIds = Array.isArray(lecturerIds)
        ? Array.from(new Set(lecturerIds.filter(Boolean)))
        : [];
    } else if (lecturerId !== undefined) {
      nextLecturerIds = lecturerId ? [lecturerId] : [];
    }

    // Verify Faculty Board approval for any assigned examiners/lecturers
    const checkIds = Array.from(
      new Set(
        [
          firstExaminerId !== undefined ? firstExaminerId : null,
          moderatorId !== undefined ? moderatorId : null,
          ...(nextLecturerIds || []),
        ].filter(Boolean) as string[]
      )
    );

    if (checkIds.length > 0) {
      const staff = await prisma.user.findMany({ where: { id: { in: checkIds } } });
      const unapproved = staff.find((u) => !u.facultyBoardApproved);
      if (unapproved) {
        return NextResponse.json(
          {
            error: `${unapproved.name} has not been approved by the Faculty Board. Only Faculty Board approved lecturers can be assigned by the HOD.`,
          },
          { status: 400 }
        );
      }
    }

    const data: any = {};
    if (code !== undefined) data.code = code;
    if (name !== undefined) data.name = name;
    if (academicYear !== undefined) data.academicYear = academicYear;
    if (semester !== undefined) data.semester = Number(semester);

    if (firstExaminerId !== undefined) {
      data.firstExaminerId = firstExaminerId || null;
    }
    if (nextLecturerIds !== undefined) {
      data.lecturerIds = nextLecturerIds;
      data.lecturerId = nextLecturerIds[0] || nextFirstExaminerId || null;
    } else if (firstExaminerId !== undefined && !existing.lecturerId) {
      data.lecturerId = firstExaminerId || null;
    }
    if (moderatorId !== undefined) {
      data.moderatorId = moderatorId || null;
    }

    const updatedSubject = await prisma.subject.update({
      where: { id },
      data,
    });

    // Sync draft paper owner if First Examiner changed before paper submission
    if (firstExaminerId) {
      await prisma.paper.updateMany({
        where: { subjectId: id, status: 'DRAFT' },
        data: { lecturerId: firstExaminerId },
      });
    }

    return NextResponse.json(updatedSubject);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;

    const papers = await prisma.paper.findMany({
      where: { subjectId: id },
    });

    for (const paper of papers) {
      await prisma.moderationReport.deleteMany({
        where: { paperId: paper.id },
      });
    }

    await prisma.paper.deleteMany({
      where: { subjectId: id },
    });

    await prisma.subject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
