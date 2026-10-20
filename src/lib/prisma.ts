import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

const isLocalHost =
  connectionString.includes('127.0.0.1') || connectionString.includes('localhost');

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  dbReadyPromise?: Promise<void>;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    max: isLocalHost ? 1 : 5,
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
  });

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pgPool = pool;
  globalForPrisma.prisma = prisma;
}

const BOOTSTRAP_SQL_STATEMENTS = [
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
      CREATE TYPE "UserRole" AS ENUM ('DEPARTMENT_HEAD', 'LECTURER', 'MODERATOR');
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaperStatus') THEN
      CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'UNDER_MODERATION', 'REVISION_REQUIRED', 'FINALIZED');
    END IF;
  END $$;`,
  `ALTER TYPE "PaperStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "contact" TEXT,
    "department" TEXT,
    "facultyBoardApproved" BOOLEAN NOT NULL DEFAULT true
  );`,
  `CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "department" TEXT,
    "firstExaminerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "lecturerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "lecturerIds" JSONB,
    "moderatorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectId" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "lecturerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "PaperStatus" NOT NULL DEFAULT 'DRAFT',
    "paperUrl" TEXT,
    "paperWordUrl" TEXT,
    "markingSchemeUrl" TEXT,
    "markingSchemeWordUrl" TEXT,
    "draftPaperUrl" TEXT,
    "draftPaperWordUrl" TEXT,
    "draftMarkingSchemeUrl" TEXT,
    "draftMarkingSchemeWordUrl" TEXT,
    "filePassword" TEXT,
    "sentToHod" BOOLEAN NOT NULL DEFAULT false,
    "sentToHodAt" TIMESTAMP(3)
  );`,
  `CREATE TABLE IF NOT EXISTS "ModerationReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paperId" TEXT NOT NULL UNIQUE REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "moderatorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "remarks" JSONB NOT NULL,
    "additionalComments" TEXT,
    "followUpActions" JSONB,
    "moderatorSignatureUrl" TEXT,
    "lecturerSignatureUrl" TEXT,
    "reportPdfUrl" TEXT,
    "reportWordUrl" TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facultyBoardApproved" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "firstExaminerId" TEXT;`,
  `ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "lecturerIds" JSONB;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "paperWordUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "markingSchemeWordUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftPaperUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftPaperWordUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftMarkingSchemeUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftMarkingSchemeWordUrl" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "filePassword" TEXT;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "sentToHod" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "sentToHodAt" TIMESTAMP(3);`,
  `ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "reportPdfUrl" TEXT;`,
  `ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "reportWordUrl" TEXT;`,
  `UPDATE "Subject" SET "firstExaminerId" = "lecturerId" WHERE "firstExaminerId" IS NULL AND "lecturerId" IS NOT NULL;`,
];

async function seedDepartmentDefaultsIfNeeded() {
  const marker = await prisma.systemSetting.findUnique({
    where: { key: 'department_moderation_seed_v3' },
  });
  if (marker?.value === 'done') return;

  // Ensure all standard accounts exist WITHOUT modifying any existing user's password or credentials
  const standardUsers: Array<{
    email: string;
    name: string;
    password: string;
    role: 'DEPARTMENT_HEAD' | 'LECTURER' | 'MODERATOR';
    department: string;
  }> = [
    {
      email: 'hod.cis@wayamba.lk',
      name: 'Dr. Sarah Johnson (HOD CIS)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'lecturer.cis@wayamba.lk',
      name: 'Mr. WCC Premarathna (CIS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'lecturer2.cis@wayamba.lk',
      name: 'Dr. Jane Smith (CIS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'head@example.com',
      name: 'Dr. Sarah Johnson',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'lecturer@example.com',
      name: 'Mr. WCC Premarathna',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'lecturer2@example.com',
      name: 'Dr. Jane Smith',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
    },
    {
      email: 'hod.el@wayamba.lk',
      name: 'Prof. Allen Croft (HOD EL)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Electronics',
    },
    {
      email: 'lecturer.el@wayamba.lk',
      name: 'Dr. Bruce Banner (EL)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Electronics',
    },
    {
      email: 'hod.im@wayamba.lk',
      name: 'Prof. Charles Xavier (HOD IM)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Industrial Management',
    },
    {
      email: 'lecturer.im@wayamba.lk',
      name: 'Dr. Tony Stark (IM)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Industrial Management',
    },
    {
      email: 'hod.ms@wayamba.lk',
      name: 'Prof. Diana Prince (HOD MS)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Mathematical Sciences',
    },
    {
      email: 'lecturer.ms@wayamba.lk',
      name: 'Dr. Reed Richards (MS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Mathematical Sciences',
    },
  ];

  for (const u of standardUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // NEVER overwrite existing credentials or passwords!
      create: { ...u, facultyBoardApproved: true },
    });
  }

  // Ensure default academicYear & semester setting is initialized cleanly
  const yearSetting = await prisma.systemSetting.findUnique({ where: { key: 'academicYear' } });
  const activeYear = yearSetting?.value || '2025/2026';
  if (!yearSetting) {
    await prisma.systemSetting.create({
      data: { key: 'academicYear', value: activeYear },
    });
  }
  const semSetting = await prisma.systemSetting.findUnique({ where: { key: 'semester' } });
  if (!semSetting) {
    await prisma.systemSetting.create({
      data: { key: 'semester', value: '1' },
    });
  }

  const allUsers = await prisma.user.findMany();
  const byEmail = new Map(allUsers.map((u) => [u.email, u]));

  const hodCis = byEmail.get('hod.cis@wayamba.lk')!;
  const lec1Cis = byEmail.get('lecturer.cis@wayamba.lk')!;
  const lec2Cis = byEmail.get('lecturer2.cis@wayamba.lk')!;
  const legacyLec1 = byEmail.get('lecturer@example.com')!;
  const legacyLec2 = byEmail.get('lecturer2@example.com')!;
  const hodEl = byEmail.get('hod.el@wayamba.lk')!;
  const lecEl = byEmail.get('lecturer.el@wayamba.lk')!;
  const hodIm = byEmail.get('hod.im@wayamba.lk')!;
  const lecIm = byEmail.get('lecturer.im@wayamba.lk')!;
  const hodMs = byEmail.get('hod.ms@wayamba.lk')!;
  const lecMs = byEmail.get('lecturer.ms@wayamba.lk')!;

  const sampleDocUrl = (code: string, kind: 'paper' | 'scheme', ext: 'pdf' | 'docx', ver: 'draft' | 'final' = 'draft') =>
    `/api/sample-files?code=${encodeURIComponent(code)}&kind=${kind}&format=${ext}&version=${ver}`;

  const subjectSeeds = [
    // CIS Department
    {
      code: 'CMIS 3134',
      name: 'Computer Architecture and Compiler Design',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Computing & Information Systems',
      firstExaminerId: lec1Cis.id,
      lecturerId: lec1Cis.id,
      lecturerIds: [lec1Cis.id, lec2Cis.id],
      moderatorId: lec2Cis.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('CMIS 3134', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('CMIS 3134', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('CMIS 3134', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('CMIS 3134', 'scheme', 'docx', 'draft'),
      },
    },
    {
      code: 'CMIS 3124',
      name: 'Database Management Systems',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Computing & Information Systems',
      firstExaminerId: lec2Cis.id,
      lecturerId: lec2Cis.id,
      lecturerIds: [lec2Cis.id, lec1Cis.id],
      moderatorId: lec1Cis.id,
      paper: null,
    },
    {
      code: 'CMIS 3114',
      name: 'Software Engineering',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Computing & Information Systems',
      firstExaminerId: lec1Cis.id,
      lecturerId: lec1Cis.id,
      lecturerIds: [lec1Cis.id],
      moderatorId: hodCis.id,
      paper: {
        status: 'REVISION_REQUIRED' as const,
        paperUrl: sampleDocUrl('CMIS 3114', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('CMIS 3114', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('CMIS 3114', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('CMIS 3114', 'scheme', 'docx', 'draft'),
        reportComments:
          'Questions cover core software design well. Please refine the wording of Question 3(b) and include point-by-point marks breakdown in Question 4 model answer.',
      },
    },
    {
      code: 'CMIS 4114',
      name: 'Artificial Intelligence and Machine Learning',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Computing & Information Systems',
      firstExaminerId: lec2Cis.id,
      lecturerId: lec2Cis.id,
      lecturerIds: [lec2Cis.id, lec1Cis.id],
      moderatorId: lec1Cis.id,
      paper: {
        status: 'FINALIZED' as const,
        paperUrl: sampleDocUrl('CMIS 4114', 'paper', 'pdf', 'final'),
        paperWordUrl: sampleDocUrl('CMIS 4114', 'paper', 'docx', 'final'),
        markingSchemeUrl: sampleDocUrl('CMIS 4114', 'scheme', 'pdf', 'final'),
        markingSchemeWordUrl: sampleDocUrl('CMIS 4114', 'scheme', 'docx', 'final'),
        draftPaperUrl: sampleDocUrl('CMIS 4114', 'paper', 'pdf', 'draft'),
        draftPaperWordUrl: sampleDocUrl('CMIS 4114', 'paper', 'docx', 'draft'),
        draftMarkingSchemeUrl: sampleDocUrl('CMIS 4114', 'scheme', 'pdf', 'draft'),
        draftMarkingSchemeWordUrl: sampleDocUrl('CMIS 4114', 'scheme', 'docx', 'draft'),
        filePassword: 'WUSL-CIS-4114',
        sentToHod: true,
        reportComments:
          'All four questions meet Honours Level 4 standard. Minor notation update requested in Question 2 gradient derivation.',
        followUpActions: [
          'Updated mathematical notation in Question 2(b) to match lecture notation.',
          'Added step-by-step partial marks breakdown to Question 4 marking scheme.',
        ],
      },
    },
    {
      code: 'CMIS 2113',
      name: 'Data Structures and Algorithms',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Computing & Information Systems',
      firstExaminerId: legacyLec1.id,
      lecturerId: legacyLec1.id,
      lecturerIds: [legacyLec1.id, legacyLec2.id],
      moderatorId: legacyLec2.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('CMIS 2113', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('CMIS 2113', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('CMIS 2113', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('CMIS 2113', 'scheme', 'docx', 'draft'),
      },
    },
    // Electronics Department
    {
      code: 'ELTN 3113',
      name: 'Digital Signal Processing',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Electronics',
      firstExaminerId: lecEl.id,
      lecturerId: lecEl.id,
      lecturerIds: [lecEl.id],
      moderatorId: hodEl.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('ELTN 3113', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('ELTN 3113', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('ELTN 3113', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('ELTN 3113', 'scheme', 'docx', 'draft'),
      },
    },
    {
      code: 'ELTN 3123',
      name: 'Microcontrollers and Embedded Systems',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Electronics',
      firstExaminerId: hodEl.id,
      lecturerId: hodEl.id,
      lecturerIds: [hodEl.id, lecEl.id],
      moderatorId: lecEl.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('ELTN 3123', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('ELTN 3123', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('ELTN 3123', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('ELTN 3123', 'scheme', 'docx', 'draft'),
      },
    },
    {
      code: 'ELTN 4114',
      name: 'VLSI Circuit Design',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Electronics',
      firstExaminerId: lecEl.id,
      lecturerId: lecEl.id,
      lecturerIds: [lecEl.id, hodEl.id],
      moderatorId: hodEl.id,
      paper: {
        status: 'FINALIZED' as const,
        paperUrl: sampleDocUrl('ELTN 4114', 'paper', 'pdf', 'final'),
        paperWordUrl: sampleDocUrl('ELTN 4114', 'paper', 'docx', 'final'),
        markingSchemeUrl: sampleDocUrl('ELTN 4114', 'scheme', 'pdf', 'final'),
        markingSchemeWordUrl: sampleDocUrl('ELTN 4114', 'scheme', 'docx', 'final'),
        draftPaperUrl: sampleDocUrl('ELTN 4114', 'paper', 'pdf', 'draft'),
        draftPaperWordUrl: sampleDocUrl('ELTN 4114', 'paper', 'docx', 'draft'),
        draftMarkingSchemeUrl: sampleDocUrl('ELTN 4114', 'scheme', 'pdf', 'draft'),
        draftMarkingSchemeWordUrl: sampleDocUrl('ELTN 4114', 'scheme', 'docx', 'draft'),
        filePassword: 'WUSL-EL-4114',
        sentToHod: true,
        reportComments: 'Well-balanced VLSI design paper. Timing diagram labels verified.',
        followUpActions: ['Enhanced CMOS layout figure resolution in Question 3.'],
      },
    },
    // Industrial Management Department
    {
      code: 'IMGT 3113',
      name: 'Operations Research and Optimization',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Industrial Management',
      firstExaminerId: lecIm.id,
      lecturerId: lecIm.id,
      lecturerIds: [lecIm.id],
      moderatorId: hodIm.id,
      paper: {
        status: 'REVISION_REQUIRED' as const,
        paperUrl: sampleDocUrl('IMGT 3113', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('IMGT 3113', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('IMGT 3113', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('IMGT 3113', 'scheme', 'docx', 'draft'),
        reportComments: 'Clarify simplex tableau rounding instructions in Question 2.',
      },
    },
    {
      code: 'IMGT 3123',
      name: 'Supply Chain and Logistics Management',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Industrial Management',
      firstExaminerId: hodIm.id,
      lecturerId: hodIm.id,
      lecturerIds: [hodIm.id, lecIm.id],
      moderatorId: lecIm.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('IMGT 3123', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('IMGT 3123', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('IMGT 3123', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('IMGT 3123', 'scheme', 'docx', 'draft'),
      },
    },
    {
      code: 'IMGT 4114',
      name: 'Strategic Enterprise Management',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Industrial Management',
      firstExaminerId: lecIm.id,
      lecturerId: lecIm.id,
      lecturerIds: [lecIm.id, hodIm.id],
      moderatorId: hodIm.id,
      paper: {
        status: 'FINALIZED' as const,
        paperUrl: sampleDocUrl('IMGT 4114', 'paper', 'pdf', 'final'),
        paperWordUrl: sampleDocUrl('IMGT 4114', 'paper', 'docx', 'final'),
        markingSchemeUrl: sampleDocUrl('IMGT 4114', 'scheme', 'pdf', 'final'),
        markingSchemeWordUrl: sampleDocUrl('IMGT 4114', 'scheme', 'docx', 'final'),
        draftPaperUrl: sampleDocUrl('IMGT 4114', 'paper', 'pdf', 'draft'),
        draftPaperWordUrl: sampleDocUrl('IMGT 4114', 'paper', 'docx', 'draft'),
        draftMarkingSchemeUrl: sampleDocUrl('IMGT 4114', 'scheme', 'pdf', 'draft'),
        draftMarkingSchemeWordUrl: sampleDocUrl('IMGT 4114', 'scheme', 'docx', 'draft'),
        filePassword: 'WUSL-IM-4114',
        sentToHod: true,
        reportComments: 'Case study scenarios match level 4 learning outcomes.',
        followUpActions: ['Refined rubric allocation in case analysis Question 1.'],
      },
    },
    // Mathematical Sciences Department
    {
      code: 'MATH 3114',
      name: 'Real Analysis and Topology',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Mathematical Sciences',
      firstExaminerId: lecMs.id,
      lecturerId: lecMs.id,
      lecturerIds: [lecMs.id],
      moderatorId: hodMs.id,
      paper: null,
    },
    {
      code: 'STAT 3123',
      name: 'Statistical Inference and Modeling',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Mathematical Sciences',
      firstExaminerId: hodMs.id,
      lecturerId: hodMs.id,
      lecturerIds: [hodMs.id, lecMs.id],
      moderatorId: lecMs.id,
      paper: {
        status: 'UNDER_MODERATION' as const,
        paperUrl: sampleDocUrl('STAT 3123', 'paper', 'pdf', 'draft'),
        paperWordUrl: sampleDocUrl('STAT 3123', 'paper', 'docx', 'draft'),
        markingSchemeUrl: sampleDocUrl('STAT 3123', 'scheme', 'pdf', 'draft'),
        markingSchemeWordUrl: sampleDocUrl('STAT 3123', 'scheme', 'docx', 'draft'),
      },
    },
    {
      code: 'MATH 4114',
      name: 'Numerical Methods for Partial Differential Equations',
      academicYear: activeYear,
      semester: 1,
      department: 'Department of Mathematical Sciences',
      firstExaminerId: lecMs.id,
      lecturerId: lecMs.id,
      lecturerIds: [lecMs.id, hodMs.id],
      moderatorId: hodMs.id,
      paper: {
        status: 'FINALIZED' as const,
        paperUrl: sampleDocUrl('MATH 4114', 'paper', 'pdf', 'final'),
        paperWordUrl: sampleDocUrl('MATH 4114', 'paper', 'docx', 'final'),
        markingSchemeUrl: sampleDocUrl('MATH 4114', 'scheme', 'pdf', 'final'),
        markingSchemeWordUrl: sampleDocUrl('MATH 4114', 'scheme', 'docx', 'final'),
        draftPaperUrl: sampleDocUrl('MATH 4114', 'paper', 'pdf', 'draft'),
        draftPaperWordUrl: sampleDocUrl('MATH 4114', 'paper', 'docx', 'draft'),
        draftMarkingSchemeUrl: sampleDocUrl('MATH 4114', 'scheme', 'pdf', 'draft'),
        draftMarkingSchemeWordUrl: sampleDocUrl('MATH 4114', 'scheme', 'docx', 'draft'),
        filePassword: 'WUSL-MS-4114',
        sentToHod: true,
        reportComments: 'Proof rigor and PDE stability questions are clear and well-paced.',
        followUpActions: ['Added boundary condition specification in Question 3(a).'],
      },
    },
  ];

  for (const s of subjectSeeds) {
    const subj = await prisma.subject.upsert({
      where: { code: s.code },
      update: {
        firstExaminerId: s.firstExaminerId,
        lecturerId: s.lecturerId,
        lecturerIds: s.lecturerIds,
        moderatorId: s.moderatorId,
        department: s.department,
        academicYear: s.academicYear,
      },
      create: {
        code: s.code,
        name: s.name,
        academicYear: s.academicYear,
        semester: s.semester,
        department: s.department,
        firstExaminerId: s.firstExaminerId,
        lecturerId: s.lecturerId,
        lecturerIds: s.lecturerIds,
        moderatorId: s.moderatorId,
      },
    });

    if (s.paper) {
      const existingPaper = await prisma.paper.findFirst({
        where: { subjectId: subj.id },
      });

      const paperRecord = existingPaper
        ? await prisma.paper.update({
            where: { id: existingPaper.id },
            data: {
              lecturerId: s.firstExaminerId,
              academicYear: s.academicYear,
              status: s.paper.status,
              paperUrl: existingPaper.paperUrl?.startsWith('http')
                ? existingPaper.paperUrl
                : s.paper.paperUrl,
              paperWordUrl: existingPaper.paperWordUrl || s.paper.paperWordUrl,
              markingSchemeUrl: existingPaper.markingSchemeUrl?.startsWith('http')
                ? existingPaper.markingSchemeUrl
                : s.paper.markingSchemeUrl,
              markingSchemeWordUrl:
                existingPaper.markingSchemeWordUrl || s.paper.markingSchemeWordUrl,
              draftPaperUrl: s.paper.draftPaperUrl || s.paper.paperUrl,
              draftPaperWordUrl: s.paper.draftPaperWordUrl || s.paper.paperWordUrl,
              draftMarkingSchemeUrl: s.paper.draftMarkingSchemeUrl || s.paper.markingSchemeUrl,
              draftMarkingSchemeWordUrl:
                s.paper.draftMarkingSchemeWordUrl || s.paper.markingSchemeWordUrl,
              filePassword: existingPaper.filePassword || s.paper.filePassword || null,
              sentToHod: s.paper.sentToHod ?? false,
              sentToHodAt: s.paper.sentToHod ? new Date() : null,
            },
          })
        : await prisma.paper.create({
            data: {
              subjectId: subj.id,
              lecturerId: s.firstExaminerId,
              academicYear: s.academicYear,
              semester: s.semester,
              status: s.paper.status,
              paperUrl: s.paper.paperUrl,
              paperWordUrl: s.paper.paperWordUrl,
              markingSchemeUrl: s.paper.markingSchemeUrl,
              markingSchemeWordUrl: s.paper.markingSchemeWordUrl,
              draftPaperUrl: s.paper.draftPaperUrl || s.paper.paperUrl,
              draftPaperWordUrl: s.paper.draftPaperWordUrl || s.paper.paperWordUrl,
              draftMarkingSchemeUrl: s.paper.draftMarkingSchemeUrl || s.paper.markingSchemeUrl,
              draftMarkingSchemeWordUrl:
                s.paper.draftMarkingSchemeWordUrl || s.paper.markingSchemeWordUrl,
              filePassword: s.paper.filePassword || null,
              sentToHod: s.paper.sentToHod ?? false,
              sentToHodAt: s.paper.sentToHod ? new Date() : null,
            },
          });

      if (s.paper.status === 'REVISION_REQUIRED' || s.paper.status === 'FINALIZED') {
        await prisma.moderationReport.upsert({
          where: { paperId: paperRecord.id },
          update: {},
          create: {
            paperId: paperRecord.id,
            moderatorId: s.moderatorId,
            remarks: {
              standardAppropriate: true,
              coversMainContents: true,
              assessesLearningOutcomes: true,
              clearAndUnambiguous: s.paper.status === 'FINALIZED',
              appropriateTimeAllocation: true,
              appropriateMarkAllocation: true,
              appropriateNumberingAndFormatting: true,
              clearFigures: true,
              accurateModelAnswers: true,
              structuredModelAnswers: s.paper.status === 'FINALIZED',
            },
            additionalComments: s.paper.reportComments || 'Moderated and reviewed thoroughly.',
            followUpActions: s.paper.followUpActions || [],
          },
        });
      }
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'department_moderation_seed_v3' },
    update: { value: 'done' },
    create: { key: 'department_moderation_seed_v3', value: 'done' },
  });
}

export async function ensureDbReady(): Promise<void> {
  if (!globalForPrisma.dbReadyPromise) {
    globalForPrisma.dbReadyPromise = (async () => {
      for (const stmt of BOOTSTRAP_SQL_STATEMENTS) {
        try {
          await pool.query(stmt);
        } catch (err: any) {
          // Ignore benign duplicate constraint/column messages across Postgres versions
          if (!String(err?.message || '').toLowerCase().includes('already exists')) {
            console.warn('Schema bootstrap warning:', err?.message);
          }
        }
      }
      await seedDepartmentDefaultsIfNeeded();
    })().catch((err) => {
      globalForPrisma.dbReadyPromise = undefined;
      throw err;
    });
  }
  return globalForPrisma.dbReadyPromise;
}
