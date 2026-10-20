-- AlterTable User: Faculty Board Approval flag
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facultyBoardApproved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Subject: First Examiner & Multiple Assigned Lecturers
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "firstExaminerId" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "lecturerIds" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Subject_firstExaminerId_fkey'
  ) THEN
    ALTER TABLE "Subject"
      ADD CONSTRAINT "Subject_firstExaminerId_fkey"
      FOREIGN KEY ("firstExaminerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "Subject"
SET "firstExaminerId" = "lecturerId"
WHERE "firstExaminerId" IS NULL AND "lecturerId" IS NOT NULL;

-- AlterTable Paper: Word file URLs, Draft history URLs, Finalized Password Protection, Sent to HOD tracking
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "paperWordUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "markingSchemeWordUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftPaperUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftPaperWordUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftMarkingSchemeUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "draftMarkingSchemeWordUrl" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "filePassword" TEXT;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "sentToHod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "sentToHodAt" TIMESTAMP(3);

-- AlterTable ModerationReport: Optional stored report PDF & Word URLs
ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "reportPdfUrl" TEXT;
ALTER TABLE "ModerationReport" ADD COLUMN IF NOT EXISTS "reportWordUrl" TEXT;

-- Ensure SystemSetting table exists
CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
