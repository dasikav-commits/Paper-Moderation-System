import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';

export interface SampleDocOptions {
  code: string;
  title: string;
  department: string;
  academicYear: string;
  semester: number;
  kind: 'paper' | 'scheme';
  version?: 'draft' | 'final';
  examinerName?: string;
}

export async function generateSamplePdfBuffer(opts: SampleDocOptions): Promise<Buffer> {
  const doc = new jsPDF();
  const isScheme = opts.kind === 'scheme';
  const versionLabel = opts.version === 'final' ? 'FINAL MODERATED VERSION (CONFIDENTIAL)' : 'EXAMINATION DRAFT';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('WAYAMBA UNIVERSITY OF SRI LANKA', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('FACULTY OF APPLIED SCIENCES', 105, 27, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(opts.department.toUpperCase(), 105, 33, { align: 'center' });

  doc.setDrawColor(100, 100, 100);
  doc.line(20, 38, 190, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    isScheme
      ? `${opts.code} - ${opts.title} (MARKING SCHEME)`
      : `${opts.code} - ${opts.title} (EXAMINATION PAPER)`,
    105,
    47,
    { align: 'center' }
  );

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Academic Year: ${opts.academicYear}   |   Semester ${opts.semester}   |   ${versionLabel}`, 105, 54, {
    align: 'center',
  });
  doc.text('Duration: Three (03) Hours                                    Total Marks: 100', 20, 63);
  doc.line(20, 67, 190, 67);

  let y = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isScheme ? 'CONFIDENTIAL MODEL ANSWERS & MARK ALLOCATION' : 'INSTRUCTIONS TO CANDIDATES: ANSWER ALL FOUR (04) QUESTIONS.', 20, y);
  y += 10;

  const items = isScheme
    ? [
        `Question 01 [25 Marks]: Core theoretical foundations of ${opts.title}.\n   (a) Definition and formal properties clearly stated — [07 Marks]\n   (b) Step-by-step derivation / architecture diagram accurately labeled — [10 Marks]\n   (c) Critical analysis with real-world application case study — [08 Marks]`,
        `Question 02 [25 Marks]: Analytical problem solving and design methodology.\n   (a) Problem formulation and assumptions explicitly verified — [08 Marks]\n   (b) Complete worked solution with intermediate steps — [12 Marks]\n   (c) Complexity / sensitivity interpretation — [05 Marks]`,
        `Question 03 [25 Marks]: Applied system modeling & evaluation in ${opts.code}.\n   (a) Model specification and parameter justification — [10 Marks]\n   (b) Verification of boundary cases and error handling — [09 Marks]\n   (c) Comparative discussion of trade-offs — [06 Marks]`,
        `Question 04 [25 Marks]: Comprehensive synthesis question.\n   (a) End-to-end solution design — [13 Marks]\n   (b) Validation criteria, quality assurance, and conclusion — [12 Marks]`,
      ]
    : [
        `Question 01 [25 Marks]\n(a) Explain the fundamental principles governing ${opts.title}, clearly stating key assumptions. [07 Marks]\n(b) Derive and illustrate the primary structural model studied in ${opts.code} with clearly labeled diagrams. [10 Marks]\n(c) Evaluate how modern industrial systems apply these principles in practice. [08 Marks]`,
        `Question 02 [25 Marks]\n(a) Formulate the analytical framework required to solve multi-variable problems in ${opts.title}. [08 Marks]\n(b) Apply the standard algorithm/method step by step to determine the optimal solution. [12 Marks]\n(c) Discuss the asymptotic behavior and practical constraints of your solution. [05 Marks]`,
        `Question 03 [25 Marks]\n(a) Design a complete specification addressing reliability, scalability, and accuracy for ${opts.code}. [10 Marks]\n(b) Identify potential edge cases and propose rigorous validation techniques. [09 Marks]\n(c) Compare two alternative approaches with respect to performance trade-offs. [06 Marks]`,
        `Question 04 [25 Marks]\n(a) Propose an integrated end-to-end methodology for a real-world scenario in ${opts.title}. [13 Marks]\n(b) Critically justify your design decisions and verification metrics. [12 Marks]`,
      ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5.5 + 7;
  }

  if (opts.examinerName) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`First Examiner (Paper Setter): ${opts.examinerName}`, 20, 275);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateSampleWordBuffer(opts: SampleDocOptions): Promise<Buffer> {
  const isScheme = opts.kind === 'scheme';
  const versionLabel = opts.version === 'final' ? 'FINAL MODERATED VERSION (CONFIDENTIAL)' : 'EXAMINATION DRAFT';

  const children: Paragraph[] = [
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
      spacing: { after: 200 },
      children: [new TextRun({ text: opts.department.toUpperCase(), size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { color: '666666', space: 6, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${opts.code} – ${opts.title} (${isScheme ? 'MARKING SCHEME' : 'EXAMINATION QUESTION PAPER'})`,
          bold: true,
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Academic Year: ${opts.academicYear}  |  Semester ${opts.semester}  |  ${versionLabel}  |  Duration: 03 Hours  |  Total Marks: 100`,
          italics: true,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: isScheme
            ? 'Model Answers & Structured Marking Breakdown'
            : 'Instructions: Answer ALL Four (04) Questions.',
          bold: true,
        }),
      ],
    }),
  ];

  for (let q = 1; q <= 4; q++) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: `Question 0${q} [25 Marks]`, bold: true, size: 22 })],
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: isScheme
              ? `(a) Clear conceptual explanation and formal notation for ${opts.title} [08 Marks]. (b) Detailed analytical derivation and labeled diagram [10 Marks]. (c) Practical evaluation and interpretation [07 Marks].`
              : `(a) State and explain the core principles relevant to unit ${q} of ${opts.title} [08 Marks]. (b) Solve the structured problem showing all intermediate steps clearly [10 Marks]. (c) Critically evaluate real-world design considerations [07 Marks].`,
            size: 21,
          }),
        ],
      })
    );
  }

  if (opts.examinerName) {
    children.push(
      new Paragraph({
        spacing: { before: 320 },
        children: [
          new TextRun({
            text: `Prepared by First Examiner: ${opts.examinerName}`,
            italics: true,
            color: '555555',
            size: 19,
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
