ALTER TABLE "StudyPathMilestone"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewOutcome" TEXT,
  ADD COLUMN "reviewNote" TEXT;
