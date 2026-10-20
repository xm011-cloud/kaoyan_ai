-- 产品反馈收件箱：新增字段全部可空或有默认值，保留所有旧反馈与旧状态。
ALTER TABLE "AuthorFeedback"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "sourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "clientContext" JSONB,
  ADD COLUMN IF NOT EXISTS "authorNote" TEXT,
  ADD COLUMN IF NOT EXISTS "releaseVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "AuthorFeedback_type_createdAt_idx"
  ON "AuthorFeedback"("type", "createdAt");
