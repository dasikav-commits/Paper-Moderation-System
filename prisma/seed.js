import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

const isLocalHost =
  connectionString.includes('127.0.0.1') || connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  max: isLocalHost ? 1 : 5,
  ssl: isLocalHost ? false : { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Ensure base tables/columns exist before seeding
  const ddl = [
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
  ];

  for (const stmt of ddl) {
    await pool.query(stmt);
  }

  // All original credentials & passwords strictly preserved untouched ("password")
  const users = [
    {
      email: 'hod.cis@wayamba.lk',
      name: 'Dr. Sarah Johnson (HOD CIS)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer.cis@wayamba.lk',
      name: 'Mr. WCC Premarathna (CIS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer2.cis@wayamba.lk',
      name: 'Dr. Jane Smith (CIS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'head@example.com',
      name: 'Dr. Sarah Johnson',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer@example.com',
      name: 'Mr. WCC Premarathna',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer2@example.com',
      name: 'Dr. Jane Smith',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Computing & Information Systems',
      facultyBoardApproved: true,
    },
    {
      email: 'hod.el@wayamba.lk',
      name: 'Prof. Allen Croft (HOD EL)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Electronics',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer.el@wayamba.lk',
      name: 'Dr. Bruce Banner (EL)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Electronics',
      facultyBoardApproved: true,
    },
    {
      email: 'hod.im@wayamba.lk',
      name: 'Prof. Charles Xavier (HOD IM)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Industrial Management',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer.im@wayamba.lk',
      name: 'Dr. Tony Stark (IM)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Industrial Management',
      facultyBoardApproved: true,
    },
    {
      email: 'hod.ms@wayamba.lk',
      name: 'Prof. Diana Prince (HOD MS)',
      password: 'password',
      role: 'DEPARTMENT_HEAD',
      department: 'Department of Mathematical Sciences',
      facultyBoardApproved: true,
    },
    {
      email: 'lecturer.ms@wayamba.lk',
      name: 'Dr. Reed Richards (MS)',
      password: 'password',
      role: 'LECTURER',
      department: 'Department of Mathematical Sciences',
      facultyBoardApproved: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  console.log('✅ Seeded all accounts with untouched credentials.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
