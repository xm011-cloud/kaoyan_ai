-- 周计划任务与长期路线里程碑建立可选关联；不回填或删除历史任务。
BEGIN;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_milestoneId_idx" ON "Task"("milestoneId");
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "StudyPathMilestone"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
