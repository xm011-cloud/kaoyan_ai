import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 里程碑证据只用于帮助复盘，不会自动改写掌握度或完成状态。
 * 练习、错题与课程只读取已经明确关联的 StudyEvidence，不再按科目或时间猜测归属。
 */
export interface MilestoneEvidenceItem {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  occurredAt: string;
  durationMinutes: number | null;
  score: number | null;
  maxScore: number | null;
  href: string | null;
}

export interface MilestoneEvidence {
  tasks: { total: number; completed: number; plannedMinutes: number; completedMinutes: number };
  learning: { sessions: number; minutes: number; clear: number; needsPractice: number; blocked: number };
  practice: { completed: number; scored: number; averageRate: number | null };
  wrongQuestions: { reviewed: number };
  items: MilestoneEvidenceItem[];
  reviewReady: boolean;
  prompt: string;
}

type MilestoneInput = { id: string; subject: string; createdAt: Date; progress: number; completedAt: Date | null };

function metadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function evidenceHref(item: {
  kind: string;
  sourceId: string;
  taskId: string | null;
  subject: string | null;
  metadata: Prisma.JsonValue | null;
  task: { id: string; date: Date; weekStartDate: Date | null } | null;
}): string | null {
  if (item.kind === "task_completion" && item.task) {
    const week = (item.task.weekStartDate ?? item.task.date).toISOString().slice(0, 10);
    return `/tasks?week=${week}&task=${item.task.id}`;
  }
  if (item.kind === "course_session") {
    const lessonId = metadataString(item.metadata, "courseLessonId");
    return lessonId ? `/courses?lesson=${lessonId}${item.taskId ? `&task=${item.taskId}` : ""}` : "/courses";
  }
  if (item.kind === "practice_session") return `/practice?session=${item.sourceId}&result=1`;
  if (item.kind === "wrong_review") {
    const wrongQuestionId = metadataString(item.metadata, "wrongQuestionId");
    return `/wrong-questions?${item.subject ? `subject=${encodeURIComponent(item.subject)}&` : ""}${wrongQuestionId ? `question=${wrongQuestionId}` : "tab=reviewed"}`;
  }
  return null;
}

const KIND_LABELS: Record<string, string> = {
  task_completion: "完成任务",
  course_session: "课程学习",
  practice_session: "练习",
  wrong_review: "错题复习",
};

export async function getMilestoneEvidence(userId: string, milestone: MilestoneInput): Promise<MilestoneEvidence> {
  const [tasks, evidenceRows] = await Promise.all([
    prisma.task.findMany({
      where: { userId, milestoneId: milestone.id },
      select: { completed: true, duration: true },
    }),
    prisma.studyEvidence.findMany({
      where: { userId, milestoneId: milestone.id, status: "active" },
      orderBy: { occurredAt: "desc" },
      take: 80,
      include: { task: { select: { id: true, date: true, weekStartDate: true } } },
    }),
  ]);

  const completedTasks = tasks.filter((task) => task.completed);
  const plannedMinutes = tasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const completedMinutes = completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const learningRows = evidenceRows.filter((item) => item.kind === "course_session");
  const practiceRows = evidenceRows.filter((item) => item.kind === "practice_session");
  const wrongRows = evidenceRows.filter((item) => item.kind === "wrong_review");
  const clear = learningRows.filter((item) => metadataString(item.metadata, "selfAssessment") === "clear").length;
  const needsPractice = learningRows.filter((item) => metadataString(item.metadata, "selfAssessment") === "needs_practice").length;
  const blocked = learningRows.filter((item) => metadataString(item.metadata, "selfAssessment") === "blocked").length;
  const scored = practiceRows.filter((item) => item.score != null && item.maxScore && item.maxScore > 0);
  const averageRate = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.score || 0) / (item.maxScore || 1), 0) / scored.length * 100)
    : null;
  const reviewedWrongIds = new Set(wrongRows.map((item) => metadataString(item.metadata, "wrongQuestionId") ?? item.sourceId.split(":")[0]));
  const taskRate = tasks.length ? completedTasks.length / tasks.length : 0;
  const reviewReady = !milestone.completedAt
    && tasks.length > 0
    && taskRate >= 0.8
    && (learningRows.length > 0 || practiceRows.length > 0 || milestone.progress >= 0.75);

  const items = evidenceRows.map((item) => ({
    id: item.id,
    kind: item.kind,
    kindLabel: KIND_LABELS[item.kind] ?? "学习记录",
    title: item.title,
    occurredAt: item.occurredAt.toISOString(),
    durationMinutes: item.durationMinutes,
    score: item.score,
    maxScore: item.maxScore,
    href: evidenceHref(item),
  }));

  return {
    tasks: { total: tasks.length, completed: completedTasks.length, plannedMinutes, completedMinutes },
    learning: { sessions: learningRows.length, minutes: learningRows.reduce((sum, item) => sum + (item.durationMinutes || 0), 0), clear, needsPractice, blocked },
    practice: { completed: practiceRows.length, scored: scored.length, averageRate },
    wrongQuestions: { reviewed: reviewedWrongIds.size },
    items,
    reviewReady,
    prompt: reviewReady
      ? "明确归属的执行证据已经较充分，可以结合练习、自评与错题复盘后确认下一步。"
      : "继续积累明确关联的任务、课程或练习证据；完成任务本身不等于掌握。",
  };
}
