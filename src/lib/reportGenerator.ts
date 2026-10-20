import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export const MODERATION_CRITERIA: Array<{ key: string; label: string }> = [
  {
    key: 'standardAppropriate',
    label: 'The questions are up to the standard appropriate for the level being assessed.',
  },
  {
    key: 'coversMainContents',
    label: 'Examination paper appropriately covers the main contents in the syllabus.',
  },
  {
    key: 'assessesLearningOutcomes',
    label: 'Questions assess the learning outcomes appropriately.',
  },
  {
    key: 'clearAndUnambiguous',
    label: 'Questions are clear and unambiguous.',
  },
  {
    key: 'appropriateTimeAllocation',
    label: 'Time allocation for the questions is appropriate.',
  },
  {
    key: 'appropriateMarkAllocation',
    label: 'Mark allocation for the questions is appropriate.',
  },
  {
    key: 'appropriateNumberingAndFormatting',
    label: 'Numbering of questions, sub-sections and pages and page formatting are appropriate.',
  },
  {
    key: 'clearFigures',
    label: 'Figures are clear and correctly labeled.',
  },
  {
    key: 'accurateModelAnswers',
    label: 'Model answers are accurate.',
  },
  {
    key: 'structuredModelAnswers',
    label: 'Model answers are structured with breakdown of marks.',
  },
];

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });

export async function downloadModerationReportPdf(
  paper: any,
  moderationReport: any,
  overrideFollowUpActions?: string[],
  lecturerSignaturePreviewUrl?: string | null
) {
  const doc = new jsPDF();
  const isFinalized = paper?.status === 'finalized';

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('WAYAMBA UNIVERSITY OF SRI LANKA', 105, 18, { align: 'center' });
  doc.setFontSize(12);
  doc.text('FACULTY OF APPLIED SCIENCES', 105, 25, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Examination Question Paper Moderation Report', 105, 32, { align: 'center' });

  doc.setFontSize(9.5);
  let yPos = 43;
  doc.text(`Subject: ${paper.subjectName}`, 20, yPos);
  doc.text(`Course Code: ${paper.subjectCode}`, 130, yPos);
  yPos += 6;
  doc.text(`Academic Year: ${paper.academicYear}`, 20, yPos);
  doc.text(`Semester: Semester ${paper.semester}`, 130, yPos);
  yPos += 6;
  doc.text(
    `First Examiner (Setter): ${paper.firstExaminerName || paper.lecturerName || 'N/A'}`,
    20,
    yPos
  );
  doc.text(
    `Status: ${isFinalized ? 'FINALIZED & SENT TO HOD' : 'REVISION / MODERATION'}`,
    130,
    yPos
  );
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("Moderator's Assessment Remarks", 20, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 4;

  const remarksObj = moderationReport?.remarks || {};
  const remarksData = MODERATION_CRITERIA.map((item, idx) => [
    `${idx + 1}. ${item.label}`,
    remarksObj[item.key] ? 'Yes' : 'No',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Moderation Criteria', 'Status']],
    body: remarksData,
    theme: 'grid',
    styles: { fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 25, halign: 'center' } },
  });

  yPos = (doc as any).lastAutoTable.finalY + 9;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Additional Comments by Moderator:', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const splitComments = doc.splitTextToSize(
    moderationReport?.additionalComments || 'No additional comments.',
    170
  );
  doc.text(splitComments, 20, yPos);
  yPos += splitComments.length * 5 + 8;

  const rawActions: string[] =
    overrideFollowUpActions ??
    (Array.isArray(moderationReport?.followUpActions) ? moderationReport.followUpActions : []);
  const actions = rawActions.filter((a) => a && String(a).trim());

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Follow-Up Actions by First Examiner:', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (actions.length > 0) {
    for (let i = 0; i < actions.length; i++) {
      const lines = doc.splitTextToSize(`${i + 1}. ${actions[i]}`, 165);
      doc.text(lines, 24, yPos);
      yPos += lines.length * 5;
    }
  } else {
    doc.text('Pending follow-up response from First Examiner.', 24, yPos);
    yPos += 5;
  }

  yPos += 10;
  if (yPos > 220) {
    doc.addPage();
    yPos = 24;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Moderator Digital Signature:', 20, yPos);
  doc.text('First Examiner Digital Signature:', 110, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${moderationReport?.moderatorName || paper?.moderatorName || 'Moderator'}`, 20, yPos + 5);
  doc.text(`Name: ${paper?.firstExaminerName || paper?.lecturerName || 'First Examiner'}`, 110, yPos + 5);
  doc.text(`Signed: ${new Date(moderationReport?.createdAt || Date.now()).toLocaleString()}`, 20, yPos + 10);
  doc.text(
    `Signed: ${
      isFinalized
        ? new Date(paper?.sentToHodAt || paper?.updatedAt || Date.now()).toLocaleString()
        : 'Pending Finalization'
    }`,
    110,
    yPos + 10
  );

  if (moderationReport?.moderatorSignatureUrl) {
    try {
      const modImg = await loadImage(moderationReport.moderatorSignatureUrl);
      doc.addImage(modImg, 'PNG', 20, yPos + 13, 38, 14);
    } catch {
      // ignore cross-origin failure if any
    }
  }

  const lecSig = isFinalized ? moderationReport?.lecturerSignatureUrl : lecturerSignaturePreviewUrl;
  if (lecSig) {
    try {
      const lecImg = await loadImage(lecSig);
      doc.addImage(lecImg, 'PNG', 110, yPos + 13, 38, 14);
    } catch {
      // ignore cross-origin failure if any
    }
  }

  doc.text('_____________________________________', 20, yPos + 31);
  doc.text('Signature of Moderator', 20, yPos + 36);
  doc.text('_____________________________________', 110, yPos + 31);
  doc.text('Signature of First Examiner', 110, yPos + 36);

  doc.save(`Moderation_Report_${paper.subjectCode.replace(/\s+/g, '_')}.pdf`);
}

export async function downloadModerationReportWord(
  paper: any,
  moderationReport: any,
  overrideFollowUpActions?: string[]
) {
  const isFinalized = paper?.status === 'finalized';
  const remarksObj = moderationReport?.remarks || {};
  const rawActions: string[] =
    overrideFollowUpActions ??
    (Array.isArray(moderationReport?.followUpActions) ? moderationReport.followUpActions : []);
  const actions = rawActions.filter((a) => a && String(a).trim());

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  const criteriaRows = [
    new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 80, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Moderation Criteria', bold: true })] })],
        }),
        new TableCell({
          borders: cellBorders,
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Response', bold: true })],
            }),
          ],
        }),
      ],
    }),
    ...MODERATION_CRITERIA.map(
      (item, index) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              children: [new Paragraph({ text: `${index + 1}. ${item.label}` })],
            }),
            new TableCell({
              borders: cellBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: remarksObj[item.key] ? 'Yes' : 'No',
                      bold: true,
                      color: remarksObj[item.key] ? '15803D' : 'B45309',
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'WAYAMBA UNIVERSITY OF SRI LANKA', bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'FACULTY OF APPLIED SCIENCES', bold: true, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'Examination Question Paper Moderation Report',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Course Code & Title: ', bold: true }),
              new TextRun({ text: `${paper.subjectCode} – ${paper.subjectName}` }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Academic Year & Semester: ', bold: true }),
              new TextRun({ text: `${paper.academicYear} | Semester ${paper.semester}` }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'First Examiner (Paper Setter): ', bold: true }),
              new TextRun({ text: `${paper.firstExaminerName || paper.lecturerName || 'N/A'}` }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Moderator: ', bold: true }),
              new TextRun({ text: `${moderationReport?.moderatorName || paper.moderatorName || 'N/A'}` }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Moderation Workflow Status: ', bold: true }),
              new TextRun({
                text: isFinalized ? 'FINALIZED & SUBMITTED TO HOD' : 'UNDER MODERATION / REVISION',
                bold: true,
                color: isFinalized ? '15803D' : 'B45309',
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 120, after: 120 },
            children: [new TextRun({ text: "1. Moderator's Remarks", bold: true })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: criteriaRows,
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '2. Additional Comments by Moderator', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            text: moderationReport?.additionalComments || 'No additional comments.',
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '3. Follow-Up Actions Taken by First Examiner', bold: true })],
          }),
          ...(actions.length > 0
            ? actions.map(
                (action, idx) =>
                  new Paragraph({
                    spacing: { after: 60 },
                    text: `${idx + 1}. ${action}`,
                  })
              )
            : [
                new Paragraph({
                  text: 'No follow-up actions recorded yet.',
                }),
              ]),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 260, after: 100 },
            children: [new TextRun({ text: '4. Digital Verification Summary', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 60 },
            text: `Moderator Signed By: ${moderationReport?.moderatorName || paper.moderatorName || 'N/A'} (${new Date(
              moderationReport?.createdAt || Date.now()
            ).toLocaleString()}) — Verified`,
          }),
          new Paragraph({
            text: `First Examiner Signed By: ${paper.firstExaminerName || paper.lecturerName || 'N/A'} (${
              isFinalized
                ? `${new Date(paper.sentToHodAt || paper.updatedAt || Date.now()).toLocaleString()} — Verified & Sent to HOD`
                : 'Pending Finalization'
            })`,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Moderation_Report_${paper.subjectCode.replace(/\s+/g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
