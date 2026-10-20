import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const normalizeDept = (d: string) =>
  d.toLowerCase().replace(/and/g, '&').replace(/\s+/g, ' ').trim();

export async function enrichSubjects(subjects: any[]) {
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      facultyBoardApproved: true,
      role: true,
    },
  });
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  return subjects.map((s) => {
    const rawIds: string[] = Array.isArray(s.lecturerIds)
      ? s.lecturerIds.filter(Boolean)
      : s.lecturerId
      ? [s.lecturerId]
      : s.firstExaminerId
      ? [s.firstExaminerId]
      : [];

    const uniqueIds = Array.from(new Set(rawIds));
    const lecturers = uniqueIds
      .map((uid) => userMap.get(uid))
      .filter(Boolean);

    const effectiveFirstExaminer = s.firstExaminer || s.lecturer || null;

    return {
      ...s,
      firstExaminerId: s.firstExaminerId || s.lecturerId || null,
      firstExaminer: effectiveFirstExaminer,
      lecturerIds: uniqueIds,
      lecturers,
    };
  });
}

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const subjects = await prisma.subject.findMany({
      include: {
        firstExaminer: true,
        lecturer: true,
        moderator: true,
        papers: {
          include: { moderationReport: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    const filtered = department
      ? subjects.filter((s) => normalizeDept(s.department || '') === normalizeDept(department))
      : subjects;

    return NextResponse.json(await enrichSubjects(filtered));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    let {
      code,
      name,
      academicYear,
      semester,
      firstExaminerId,
      lecturerId,
      lecturerIds,
      moderatorId,
      department,
      assignedByUserId,
    } = body;

    if (assignedByUserId) {
      const actor = await prisma.user.findUnique({ where: { id: assignedByUserId } });
      if (!actor || actor.role !== 'DEPARTMENT_HEAD') {
        return NextResponse.json(
          { error: 'Only the Head of Department (HOD) can assign examiners.' },
          { status: 403 }
        );
      }
    }

    if (!academicYear) {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'academicYear' } });
      academicYear = setting?.value || '2025/2026';
    }

    if (!code || !name || !semester) {
      return NextResponse.json(
        { error: 'Subject code, name, and semester are required' },
        { status: 400 }
      );
    }

    const existingSubject = await prisma.subject.findUnique({
      where: { code: String(code).trim() },
    });

    if (existingSubject) {
      return NextResponse.json(
        { error: 'Subject with this code already exists' },
        { status: 400 }
      );
    }

    const cleanFirst = firstExaminerId || lecturerId || null;
    const cleanMod = moderatorId || null;
    if (cleanFirst && cleanMod && cleanFirst === cleanMod) {
      return NextResponse.json(
        { error: 'First Examiner and Moderator cannot be the same staff member.' },
        { status: 400 }
      );
    }

    const parsedLecturerIds: string[] = Array.isArray(lecturerIds)
      ? Array.from(new Set(lecturerIds.filter(Boolean)))
      : cleanFirst
      ? [cleanFirst]
      : [];

    const staffIdsToVerify = Array.from(
      new Set([cleanFirst, cleanMod, ...parsedLecturerIds].filter(Boolean) as string[])
    );
    if (staffIdsToVerify.length > 0) {
      const staff = await prisma.user.findMany({ where: { id: { in: staffIdsToVerify } } });
      const unapproved = staff.find((u) => !u.facultyBoardApproved);
      if (unapproved) {
        return NextResponse.json(
          {
            error: `${unapproved.name} is not yet approved by the Faculty Board. Only Faculty Board approved lecturers can be assigned.`,
          },
          { status: 400 }
        );
      }
    }

    const newSubject = await prisma.subject.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
        academicYear,
        semester: Number(semester),
        firstExaminerId: cleanFirst,
        lecturerId: parsedLecturerIds[0] || cleanFirst,
        lecturerIds: parsedLecturerIds,
        moderatorId: cleanMod,
        department: department || null,
      },
    });

    return NextResponse.json(newSubject, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
