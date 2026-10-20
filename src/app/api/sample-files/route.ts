import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateSamplePdfBuffer, generateSampleWordBuffer } from '@/lib/sampleDocs';

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || 'CMIS 3134';
    const kind = searchParams.get('kind') === 'scheme' ? 'scheme' : 'paper';
    const format = searchParams.get('format') === 'docx' ? 'docx' : 'pdf';
    const version = searchParams.get('version') === 'final' ? 'final' : 'draft';

    const subject = await prisma.subject.findUnique({
      where: { code },
      include: { firstExaminer: true, lecturer: true },
    });

    const opts = {
      code,
      title: subject?.name || 'University Examination Course',
      department: subject?.department || 'Faculty of Applied Sciences',
      academicYear: subject?.academicYear || '2025/2026',
      semester: subject?.semester || 1,
      kind: kind as 'paper' | 'scheme',
      version: version as 'draft' | 'final',
      examinerName: subject?.firstExaminer?.name || subject?.lecturer?.name || undefined,
    };

    const buffer =
      format === 'pdf'
        ? await generateSamplePdfBuffer(opts)
        : await generateSampleWordBuffer(opts);

    const safeCode = code.replace(/\s+/g, '_');
    const filename = `${safeCode}_${kind === 'scheme' ? 'Marking_Scheme' : 'Exam_Paper'}.${format}`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `${
          format === 'pdf' ? 'inline' : 'attachment'
        }; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
