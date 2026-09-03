import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function dbStatusToClient(status: string): string {
  switch (status) {
    case "DRAFT": return "draft";
    case "UNDER_MODERATION": return "under_moderation";
    case "REVISION_REQUIRED": return "revision_required";
    case "FINALIZED": return "finalized";
    default: return "draft";
  }
}

function clientStatusToDb(status: string): string {
  switch (status.toLowerCase()) {
    case "draft": return "DRAFT";
    case "submitted":
    case "under_moderation": return "UNDER_MODERATION";
    case "revision_required": return "REVISION_REQUIRED";
    case "finalized": return "FINALIZED";
    default: return "DRAFT";
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get("lecturerId");
    const moderatorId = searchParams.get("moderatorId");
    const department = searchParams.get("department");

    const where: any = {};
    if (department) {
      where.subject = { department };
    }

    // Fetch all real papers from database
    const dbPapers = await prisma.paper.findMany({
      where,
      include: {
        subject: {
          include: {
            lecturer: true,
            moderator: true,
          },
        },
        lecturer: true,
      },
    });

    let clientPapers = dbPapers.map((p) => ({
      id: p.id,
      subjectId: p.subjectId,
      subjectCode: p.subject.code,
      subjectName: p.subject.name,
      lecturerId: p.lecturerId,
      lecturerName: p.lecturer.name,
      moderatorId: p.subject.moderatorId || "",
      moderatorName: p.subject.moderator?.name || "",
      academicYear: p.academicYear,
      semester: p.semester,
      status: dbStatusToClient(p.status),
      paperUrl: p.paperUrl || undefined,
      markingSchemeUrl: p.markingSchemeUrl || undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    // If filtered by lecturer, check if there are subjects without papers
    if (lecturerId) {
      // Filter the existing real papers
      let lecturerPapers = clientPapers.filter((p) => p.lecturerId === lecturerId);

      // Find subjects assigned to this lecturer
      const subjects = await prisma.subject.findMany({
        where: { lecturerId },
        include: {
          lecturer: true,
          moderator: true,
          papers: true,
        },
      });

      // Add virtual draft papers for subjects that have no paper record for their active academic year
      for (const subject of subjects) {
        const hasPaperForYear = subject.papers.some((p) => p.academicYear === subject.academicYear);
        if (!hasPaperForYear) {
          lecturerPapers.push({
            id: `virtual-${subject.id}`, // prefix with virtual so client knows to create it on upload
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            lecturerId: subject.lecturerId || "",
            lecturerName: subject.lecturer?.name || "",
            moderatorId: subject.moderatorId || "",
            moderatorName: subject.moderator?.name || "",
            academicYear: subject.academicYear,
            semester: subject.semester,
            status: "draft",
            paperUrl: undefined,
            markingSchemeUrl: undefined,
            createdAt: subject.createdAt.toISOString(),
            updatedAt: subject.updatedAt.toISOString(),
          });
        }
      }
      return NextResponse.json(lecturerPapers);
    }

    // If filtered by moderator, we only show papers that are assigned to subjects moderated by this user
    if (moderatorId) {
      // Find subjects where the moderator is this user
      const subjects = await prisma.subject.findMany({
        where: { moderatorId },
        select: { id: true },
      });
      const subjectIds = subjects.map((s) => s.id);
      clientPapers = clientPapers.filter((p) => subjectIds.includes(p.subjectId));
      return NextResponse.json(clientPapers);
    }

    return NextResponse.json(clientPapers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subjectId, lecturerId, academicYear, semester, status, paperUrl, markingSchemeUrl } = body;

    if (!subjectId || !lecturerId) {
      return NextResponse.json(
        { error: "Subject ID and Lecturer ID are required" },
        { status: 400 }
      );
    }

    const newPaper = await prisma.paper.create({
      data: {
        subjectId,
        lecturerId,
        academicYear: academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        semester: Number(semester) || 1,
        status: clientStatusToDb(status || "DRAFT") as any,
        paperUrl: paperUrl || null,
        markingSchemeUrl: markingSchemeUrl || null,
      },
    });

    return NextResponse.json(newPaper, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
