import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const normalizeDept = (d: string) =>
  d.toLowerCase().replace(/and/g, '&').replace(/\s+/g, ' ').trim();

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('paperId');
    const moderatorId = searchParams.get('moderatorId');
    const department = searchParams.get('department');

    if (paperId) {
      const report = await prisma.moderationReport.findUnique({
        where: { paperId },
        include: {
          moderator: true,
        },
      });

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: report.id,
        paperId: report.paperId,
        moderatorId: report.moderatorId,
        moderatorName: report.moderator.name,
        remarks: report.remarks,
        additionalComments: report.additionalComments,
        followUpActions: report.followUpActions || [],
        moderatorSignatureUrl: report.moderatorSignatureUrl,
        lecturerSignatureUrl: report.lecturerSignatureUrl,
        reportPdfUrl: report.reportPdfUrl,
        reportWordUrl: report.reportWordUrl,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      });
    }

    const reports = await prisma.moderationReport.findMany({
      where: moderatorId ? { moderatorId } : undefined,
      include: {
        moderator: true,
        paper: {
          include: {
            lecturer: true,
            subject: {
              include: {
                firstExaminer: true,
                lecturer: true,
                moderator: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const filtered = department
      ? reports.filter(
          (r) => normalizeDept(r.paper.subject.department || '') === normalizeDept(department)
        )
      : reports;

    return NextResponse.json(
      filtered.map((r) => ({
        id: r.id,
        paperId: r.paperId,
        moderatorId: r.moderatorId,
        moderatorName: r.moderator.name,
        remarks: r.remarks,
        additionalComments: r.additionalComments,
        followUpActions: r.followUpActions || [],
        moderatorSignatureUrl: r.moderatorSignatureUrl,
        lecturerSignatureUrl: r.lecturerSignatureUrl,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        paper: {
          id: r.paper.id,
          subjectId: r.paper.subjectId,
          subjectCode: r.paper.subject.code,
          subjectName: r.paper.subject.name,
          academicYear: r.paper.academicYear,
          semester: r.paper.semester,
          status: r.paper.status.toLowerCase(),
          firstExaminerName:
            r.paper.subject.firstExaminer?.name ||
            r.paper.subject.lecturer?.name ||
            r.paper.lecturer.name,
          lecturerName: r.paper.lecturer.name,
          moderatorName: r.moderator.name,
          sentToHod: r.paper.sentToHod,
          sentToHodAt: r.paper.sentToHodAt ? r.paper.sentToHodAt.toISOString() : undefined,
          updatedAt: r.paper.updatedAt.toISOString(),
        },
      }))
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const {
      paperId,
      moderatorId,
      remarks,
      additionalComments,
      followUpActions,
      moderatorSignatureUrl,
      lecturerSignatureUrl,
      reportPdfUrl,
      reportWordUrl,
      preserveStatus,
    } = body;

    if (!paperId || !moderatorId || !remarks) {
      return NextResponse.json(
        { error: 'Paper ID, Moderator ID, and Remarks are required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      moderatorId,
      remarks,
      additionalComments: additionalComments || '',
      followUpActions: followUpActions || null,
    };
    if (moderatorSignatureUrl !== undefined) {
      updateData.moderatorSignatureUrl = moderatorSignatureUrl;
    }
    if (lecturerSignatureUrl !== undefined) {
      updateData.lecturerSignatureUrl = lecturerSignatureUrl;
    }
    if (reportPdfUrl !== undefined) {
      updateData.reportPdfUrl = reportPdfUrl;
    }
    if (reportWordUrl !== undefined) {
      updateData.reportWordUrl = reportWordUrl;
    }

    const report = await prisma.moderationReport.upsert({
      where: { paperId },
      update: updateData,
      create: {
        paperId,
        moderatorId,
        remarks,
        additionalComments: additionalComments || '',
        followUpActions: followUpActions || null,
        moderatorSignatureUrl: moderatorSignatureUrl || null,
        lecturerSignatureUrl: lecturerSignatureUrl || null,
        reportPdfUrl: reportPdfUrl || null,
        reportWordUrl: reportWordUrl || null,
      },
    });

    if (!preserveStatus) {
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: 'REVISION_REQUIRED',
        },
      });
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
