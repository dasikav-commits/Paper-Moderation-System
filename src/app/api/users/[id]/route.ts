import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const body = await request.json();
    const { name, email, role, department, contact, facultyBoardApproved } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (department !== undefined) data.department = department;
    if (contact !== undefined) data.contact = contact;
    if (facultyBoardApproved !== undefined) {
      data.facultyBoardApproved = Boolean(facultyBoardApproved);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const { id } = await params;
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.password !== currentPassword) {
      return NextResponse.json(
        { error: 'Incorrect current password' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: { password: newPassword },
    });

    return NextResponse.json({ success: true });
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

    await prisma.moderationReport.deleteMany({
      where: { moderatorId: id },
    });

    const userPapers = await prisma.paper.findMany({
      where: { lecturerId: id },
      select: { id: true },
    });
    for (const p of userPapers) {
      await prisma.moderationReport.deleteMany({ where: { paperId: p.id } });
    }

    await prisma.paper.deleteMany({
      where: { lecturerId: id },
    });

    await prisma.subject.updateMany({
      where: { firstExaminerId: id },
      data: { firstExaminerId: null },
    });

    await prisma.subject.updateMany({
      where: { lecturerId: id },
      data: { lecturerId: null },
    });

    await prisma.subject.updateMany({
      where: { moderatorId: id },
      data: { moderatorId: null },
    });

    const allSubjects = await prisma.subject.findMany();
    for (const subj of allSubjects) {
      if (Array.isArray(subj.lecturerIds) && subj.lecturerIds.includes(id)) {
        await prisma.subject.update({
          where: { id: subj.id },
          data: {
            lecturerIds: (subj.lecturerIds as string[]).filter((uid) => uid !== id),
          },
        });
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
