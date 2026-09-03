-- Prisma schema engine cannot reach this Neon endpoint in this environment.
-- This migration is deliberately additive/backfill-only and runs atomically.
BEGIN;

ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'postgraduate';
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "direction" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "examYear" INTEGER;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "certainty" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Goal" ALTER COLUMN "university" DROP NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "major" DROP NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "examDate" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "StudyProfileFact" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "key" TEXT NOT NULL, "label" TEXT NOT NULL,
  "value" JSONB NOT NULL, "source" TEXT NOT NULL, "confidence" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'confirmed', "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewAt" TIMESTAMP(3), "supersededBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StudyProfileFact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyProfileFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudyProfileFact_userId_status_idx" ON "StudyProfileFact"("userId","status");
CREATE INDEX IF NOT EXISTS "StudyProfileFact_userId_key_status_idx" ON "StudyProfileFact"("userId","key","status");

DROP INDEX IF EXISTS "StudyPath_userId_key";
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "goalId" TEXT;
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "supersedesId" TEXT;
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "adjustmentRequest" TEXT;
ALTER TABLE "StudyPath" ADD COLUMN IF NOT EXISTS "changeImpact" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPath_userId_version_key" ON "StudyPath"("userId","version");
CREATE INDEX IF NOT EXISTS "StudyPath_userId_status_idx" ON "StudyPath"("userId","status");
CREATE INDEX IF NOT EXISTS "StudyPath_goalId_idx" ON "StudyPath"("goalId");
ALTER TABLE "StudyPath" ADD CONSTRAINT "StudyPath_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyPath" ADD CONSTRAINT "StudyPath_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "StudyPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StudyPathStage" (
  "id" TEXT NOT NULL, "studyPathId" TEXT NOT NULL, "key" TEXT NOT NULL, "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL, "objective" TEXT NOT NULL, "exitCriteria" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyPathStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyPathStage_studyPathId_fkey" FOREIGN KEY ("studyPathId") REFERENCES "StudyPath"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPathStage_studyPathId_key_key" ON "StudyPathStage"("studyPathId","key");
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPathStage_studyPathId_order_key" ON "StudyPathStage"("studyPathId","order");
CREATE INDEX IF NOT EXISTS "StudyPathStage_studyPathId_status_idx" ON "StudyPathStage"("studyPathId","status");

CREATE TABLE IF NOT EXISTS "WeeklyPlan" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "studyPathId" TEXT, "stageId" TEXT,
  "weekStart" TIMESTAMP(3) NOT NULL, "weekEnd" TIMESTAMP(3) NOT NULL, "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', "objective" TEXT NOT NULL, "rationale" TEXT NOT NULL,
  "successCriteria" JSONB NOT NULL, "plannedMinutes" INTEGER NOT NULL DEFAULT 0, "items" JSONB NOT NULL,
  "adjustmentRequest" TEXT, "constraints" JSONB, "generatedBy" TEXT NOT NULL DEFAULT 'ai',
  "confirmedAt" TIMESTAMP(3), "supersedesId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeeklyPlan_studyPathId_fkey" FOREIGN KEY ("studyPathId") REFERENCES "StudyPath"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WeeklyPlan_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "StudyPathStage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WeeklyPlan_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "WeeklyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyPlan_userId_weekStart_version_key" ON "WeeklyPlan"("userId","weekStart","version");
CREATE INDEX IF NOT EXISTS "WeeklyPlan_userId_weekStart_status_idx" ON "WeeklyPlan"("userId","weekStart","status");
CREATE INDEX IF NOT EXISTS "WeeklyPlan_studyPathId_idx" ON "WeeklyPlan"("studyPathId");
CREATE INDEX IF NOT EXISTS "WeeklyPlan_stageId_idx" ON "WeeklyPlan"("stageId");

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "weeklyPlanId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_weeklyPlanId_idx" ON "Task"("weeklyPlanId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "WeeklyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyPathMilestone" ADD COLUMN IF NOT EXISTS "stageId" TEXT;
CREATE INDEX IF NOT EXISTS "StudyPathMilestone_stageId_idx" ON "StudyPathMilestone"("stageId");
ALTER TABLE "StudyPathMilestone" ADD CONSTRAINT "StudyPathMilestone_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "StudyPathStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "review" JSONB;
COMMIT;
