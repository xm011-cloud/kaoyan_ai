-- 统一学习证据账本：只回填确定发生过的行为；无法确定的里程碑归属保持 NULL。
BEGIN;

ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN IF NOT EXISTS "practiceSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "StudySession_milestoneId_idx" ON "StudySession"("milestoneId");
CREATE INDEX IF NOT EXISTS "PracticeSession_taskId_idx" ON "PracticeSession"("taskId");
CREATE INDEX IF NOT EXISTS "PracticeSession_milestoneId_idx" ON "PracticeSession"("milestoneId");
CREATE INDEX IF NOT EXISTS "WrongQuestion_taskId_idx" ON "WrongQuestion"("taskId");
CREATE INDEX IF NOT EXISTS "WrongQuestion_milestoneId_idx" ON "WrongQuestion"("milestoneId");
CREATE INDEX IF NOT EXISTS "WrongQuestion_practiceSessionId_idx" ON "WrongQuestion"("practiceSessionId");

DO $$ BEGIN
  ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "StudyPathMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "StudyPathMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "StudyPathMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_practiceSessionId_fkey"
    FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudyEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "taskId" TEXT,
  "kind" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMinutes" INTEGER,
  "score" INTEGER,
  "maxScore" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyEvidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "StudyPathMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudyEvidence_userId_kind_sourceId_key" ON "StudyEvidence"("userId", "kind", "sourceId");
CREATE INDEX IF NOT EXISTS "StudyEvidence_userId_occurredAt_idx" ON "StudyEvidence"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StudyEvidence_milestoneId_status_occurredAt_idx" ON "StudyEvidence"("milestoneId", "status", "occurredAt");
CREATE INDEX IF NOT EXISTS "StudyEvidence_taskId_idx" ON "StudyEvidence"("taskId");

-- 课程会话已有可靠 taskId 时，可确定地继承任务的里程碑。
UPDATE "StudySession" AS session
SET "milestoneId" = task."milestoneId"
FROM "Task" AS task
WHERE session."taskId" = task."id"
  AND session."milestoneId" IS NULL
  AND task."milestoneId" IS NOT NULL;

-- 历史已完成任务、课程、练习和错题复习进入账本；不根据科目或标题猜里程碑。
INSERT INTO "StudyEvidence" (
  "id", "userId", "milestoneId", "taskId", "kind", "sourceId", "title", "subject",
  "status", "occurredAt", "durationMinutes", "metadata", "createdAt", "updatedAt"
)
SELECT 'legacy-task-' || task."id", task."userId", task."milestoneId", task."id",
  'task_completion', task."id", task."title", task."subject", 'active', task."updatedAt",
  task."duration", jsonb_build_object('backfilled', true), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Task" AS task
WHERE task."completed" = true
ON CONFLICT ("userId", "kind", "sourceId") DO NOTHING;

INSERT INTO "StudyEvidence" (
  "id", "userId", "milestoneId", "taskId", "kind", "sourceId", "title", "subject",
  "status", "occurredAt", "durationMinutes", "metadata", "createdAt", "updatedAt"
)
SELECT 'legacy-course-' || session."id", session."userId", session."milestoneId", session."taskId",
  'course_session', session."id", lesson."title", COALESCE(task."subject", course."subject"),
  'active', COALESCE(session."endedAt", session."updatedAt"), session."actualMinutes",
  jsonb_build_object('selfAssessment', session."selfAssessment", 'courseLessonId', session."courseLessonId", 'backfilled', true),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudySession" AS session
JOIN "CourseLesson" AS lesson ON lesson."id" = session."courseLessonId"
JOIN "CourseUnit" AS unit ON unit."id" = lesson."courseUnitId"
JOIN "Course" AS course ON course."id" = unit."courseId"
LEFT JOIN "Task" AS task ON task."id" = session."taskId"
WHERE session."status" = 'completed'
ON CONFLICT ("userId", "kind", "sourceId") DO NOTHING;

INSERT INTO "StudyEvidence" (
  "id", "userId", "milestoneId", "taskId", "kind", "sourceId", "title", "subject",
  "status", "occurredAt", "durationMinutes", "score", "maxScore", "metadata", "createdAt", "updatedAt"
)
SELECT 'legacy-practice-' || practice."id", practice."userId", practice."milestoneId", practice."taskId",
  'practice_session', practice."id", '练习：' || practice."subject", practice."subject",
  'active', COALESCE(practice."completedAt", practice."createdAt"), practice."duration",
  practice."totalScore", practice."maxScore", jsonb_build_object('type', practice."type", 'backfilled', true),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PracticeSession" AS practice
WHERE practice."status" = 'completed'
ON CONFLICT ("userId", "kind", "sourceId") DO NOTHING;

INSERT INTO "StudyEvidence" (
  "id", "userId", "milestoneId", "taskId", "kind", "sourceId", "title", "subject",
  "status", "occurredAt", "metadata", "createdAt", "updatedAt"
)
SELECT 'legacy-wrong-' || wrong."id", wrong."userId", wrong."milestoneId", wrong."taskId",
  'wrong_review', wrong."id" || ':legacy', LEFT('错题复习：' || wrong."question", 160), wrong."subject",
  'active', COALESCE(wrong."lastReviewDate", wrong."updatedAt"),
  jsonb_build_object('reviewCount', wrong."reviewCount", 'backfilled', true), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WrongQuestion" AS wrong
WHERE wrong."reviewCount" > 0
ON CONFLICT ("userId", "kind", "sourceId") DO NOTHING;

COMMIT;
