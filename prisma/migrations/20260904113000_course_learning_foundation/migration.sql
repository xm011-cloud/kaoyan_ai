-- 课程学习地基：只增加结构化学习对象，不迁移或删除既有用户资料。
BEGIN;

CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT,
  "description" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "sourceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Course_userId_status_idx" ON "Course"("userId", "status");

CREATE TABLE IF NOT EXISTS "CourseUnit" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseUnit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseUnit_courseId_order_key" ON "CourseUnit"("courseId", "order");
CREATE INDEX IF NOT EXISTS "CourseUnit_courseId_idx" ON "CourseUnit"("courseId");

CREATE TABLE IF NOT EXISTS "CourseLesson" (
  "id" TEXT NOT NULL,
  "courseUnitId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "sourceUrl" TEXT,
  "materialId" TEXT,
  "plannedMinutes" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "lastPositionSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseLesson_courseUnitId_fkey" FOREIGN KEY ("courseUnitId") REFERENCES "CourseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseLesson_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseLesson_courseUnitId_order_key" ON "CourseLesson"("courseUnitId", "order");
CREATE INDEX IF NOT EXISTS "CourseLesson_courseUnitId_status_idx" ON "CourseLesson"("courseUnitId", "status");
CREATE INDEX IF NOT EXISTS "CourseLesson_materialId_idx" ON "CourseLesson"("materialId");

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "courseLessonId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_courseLessonId_idx" ON "Task"("courseLessonId");
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_courseLessonId_fkey" FOREIGN KEY ("courseLessonId") REFERENCES "CourseLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseLessonId" TEXT NOT NULL,
  "taskId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "actualMinutes" INTEGER,
  "selfAssessment" TEXT,
  "blocker" TEXT,
  "nextStep" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_courseLessonId_fkey" FOREIGN KEY ("courseLessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudySession_userId_status_idx" ON "StudySession"("userId", "status");
CREATE INDEX IF NOT EXISTS "StudySession_courseLessonId_startedAt_idx" ON "StudySession"("courseLessonId", "startedAt");
CREATE INDEX IF NOT EXISTS "StudySession_taskId_idx" ON "StudySession"("taskId");

CREATE TABLE IF NOT EXISTS "StudyNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'note',
  "courseLessonId" TEXT,
  "studySessionId" TEXT,
  "taskId" TEXT,
  "materialId" TEXT,
  "wrongQuestionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyNote_courseLessonId_fkey" FOREIGN KEY ("courseLessonId") REFERENCES "CourseLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyNote_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyNote_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyNote_wrongQuestionId_fkey" FOREIGN KEY ("wrongQuestionId") REFERENCES "WrongQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudyNote_userId_createdAt_idx" ON "StudyNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudyNote_courseLessonId_idx" ON "StudyNote"("courseLessonId");
CREATE INDEX IF NOT EXISTS "StudyNote_studySessionId_idx" ON "StudyNote"("studySessionId");
CREATE INDEX IF NOT EXISTS "StudyNote_taskId_idx" ON "StudyNote"("taskId");
CREATE INDEX IF NOT EXISTS "StudyNote_materialId_idx" ON "StudyNote"("materialId");
CREATE INDEX IF NOT EXISTS "StudyNote_wrongQuestionId_idx" ON "StudyNote"("wrongQuestionId");

COMMIT;
