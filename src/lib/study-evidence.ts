import type { Prisma } from "@prisma/client";

export const STUDY_EVIDENCE_KINDS = [
  "task_completion",
  "course_session",
  "practice_session",
  "wrong_review",
] as const;

export type StudyEvidenceKind = (typeof STUDY_EVIDENCE_KINDS)[number];

type EvidenceClient = Pick<Prisma.TransactionClient, "task" | "studyPathMilestone">;

export interface EvidenceLinkInput {
  taskId?: string | null;
  milestoneId?: string | null;
  subject?: string | null;
}

export interface ResolvedEvidenceLink {
  taskId: string | null;
  milestoneId: string | null;
  taskTitle: string | null;
  milestoneTitle: string | null;
}

/**
 * 证据归属只接受用户私有外键或任务已确认的里程碑关系。
 * 不按标题、科目或时间猜测；未知归属返回 null，后续可由用户显式补齐。
 */
export async function resolveEvidenceLink(
  db: EvidenceClient,
  userId: string,
  input: EvidenceLinkInput,
): Promise<{ link: ResolvedEvidenceLink | null; error?: string }> {
  const requestedTaskId = typeof input.taskId === "string" && input.taskId ? input.taskId : null;
  const requestedMilestoneId = typeof input.milestoneId === "string" && input.milestoneId ? input.milestoneId : null;
  const task = requestedTaskId
    ? await db.task.findFirst({
        where: { id: requestedTaskId, userId },
        select: { id: true, title: true, milestoneId: true, subject: true },
      })
    : null;
  if (requestedTaskId && !task) return { link: null, error: "关联任务不存在" };
  if (task?.milestoneId && requestedMilestoneId && task.milestoneId !== requestedMilestoneId) {
    return { link: null, error: "任务与里程碑归属不一致" };
  }
  if (task?.subject && input.subject && task.subject.trim() !== input.subject.trim()) {
    return { link: null, error: "关联任务与当前科目不一致" };
  }

  const resolvedMilestoneId = task?.milestoneId ?? requestedMilestoneId;
  const milestone = resolvedMilestoneId
    ? await db.studyPathMilestone.findFirst({
        where: { id: resolvedMilestoneId, studyPath: { userId } },
        select: { id: true, title: true, subject: true },
      })
    : null;
  if (resolvedMilestoneId && !milestone) return { link: null, error: "关联里程碑不存在" };

  // 没有任务背书时，显式选择的里程碑必须与练习/错题科目一致，避免跨科误归因。
  if (!task?.milestoneId && milestone && input.subject && milestone.subject.trim() !== input.subject.trim()) {
    return { link: null, error: "关联里程碑与当前科目不一致" };
  }

  return {
    link: {
      taskId: task?.id ?? null,
      milestoneId: milestone?.id ?? null,
      taskTitle: task?.title ?? null,
      milestoneTitle: milestone?.title ?? null,
    },
  };
}

export interface StudyEvidenceWrite {
  userId: string;
  milestoneId?: string | null;
  taskId?: string | null;
  kind: StudyEvidenceKind;
  sourceId: string;
  title: string;
  subject?: string | null;
  occurredAt?: Date;
  durationMinutes?: number | null;
  score?: number | null;
  maxScore?: number | null;
  metadata?: Prisma.InputJsonValue;
}

/** 同一来源事件只保留一条证据；网络重试和重复提交不会重复累计。 */
export async function upsertStudyEvidence(tx: Prisma.TransactionClient, input: StudyEvidenceWrite) {
  const values = {
    milestoneId: input.milestoneId ?? null,
    taskId: input.taskId ?? null,
    title: input.title.slice(0, 240),
    subject: input.subject?.slice(0, 120) || null,
    status: "active",
    occurredAt: input.occurredAt ?? new Date(),
    durationMinutes: input.durationMinutes ?? null,
    score: input.score ?? null,
    maxScore: input.maxScore ?? null,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  return tx.studyEvidence.upsert({
    where: {
      userId_kind_sourceId: {
        userId: input.userId,
        kind: input.kind,
        sourceId: input.sourceId,
      },
    },
    create: {
      userId: input.userId,
      kind: input.kind,
      sourceId: input.sourceId,
      ...values,
    },
    update: values,
  });
}

/** 撤销完成状态时保留审计痕迹，但不再计入当前有效证据。 */
export async function retractStudyEvidence(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: StudyEvidenceKind,
  sourceId: string,
) {
  return tx.studyEvidence.updateMany({
    where: { userId, kind, sourceId, status: "active" },
    data: { status: "retracted" },
  });
}
