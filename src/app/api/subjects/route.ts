import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const where = department ? { department } : {};

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        lecturer: true,
        moderator: true,
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(subjects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { code, name, academicYear, semester, lecturerId, moderatorId, department } = body;

    if (!academicYear) {
      try {
        const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'academicYear' } });
        academicYear = setting?.value || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
      } catch {
        academicYear = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
      }
    }

    if (!code || !name || !semester) {
      return NextResponse.json(
        { error: "Subject code, name, and semester are required" },
        { status: 400 }
      );
    }

    const existingSubject = await prisma.subject.findUnique({
      where: { code },
    });

    if (existingSubject) {
      return NextResponse.json(
        { error: "Subject with this code already exists" },
        { status: 400 }
      );
    }

    const newSubject = await prisma.subject.create({
      data: {
        code,
        name,
        academicYear,
        semester: Number(semester),
        lecturerId: lecturerId || null,
        moderatorId: moderatorId || null,
        department: department || null,
      },
    });

    return NextResponse.json(newSubject, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
