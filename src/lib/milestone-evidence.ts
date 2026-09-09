import { prisma } from "@/lib/prisma";

/**
 * 里程碑的进展证据只用于帮助复盘，不会自动改写掌握度或完成状态。
 * 题目、错题和学习会话目前没有直接的里程碑外键，因此仅按同科目与创建时间
 * 汇总为“辅助证据”，UI 必须明确呈现其非确定性。
 */
export interface MilestoneEvidence {
  tasks: { total: number; completed: number; plannedMinutes: number; completedMinutes: number };
  learning: { sessions: number; minutes: number; clear: number; needsPractice: number; blocked: number };
  practice: { completed: number; scored: number; averageRate: number | null };
  wrongQuestions: { reviewed: number };
  reviewReady: boolean;
  prompt: string;
}

type MilestoneInput = { id: string; subject: string; createdAt: Date; progress: number; completedAt: Date | null };

export async function getMilestoneEvidence(userId: string, milestone: MilestoneInput): Promise<MilestoneEvidence> {
  const since = milestone.createdAt;
  const [tasks, sessions, practices, reviewedWrongQuestions] = await Promise.all([
    prisma.task.findMany({
      where: { userId, milestoneId: milestone.id },
      select: { completed: true, duration: true },
    }),
    prisma.studySession.findMany({
      where: { userId, status: "completed", task: { milestoneId: milestone.id } },
      select: { actualMinutes: true, selfAssessment: true },
    }),
    prisma.practiceSession.findMany({
      where: { userId, subject: milestone.subject, status: "completed", completedAt: { gte: since } },
      select: { totalScore: true, maxScore: true },
      take: 20,
    }),
    prisma.wrongQuestion.count({
      where: { userId, subject: milestone.subject, reviewCount: { gt: 0 }, lastReviewDate: { gte: since } },
    }),
  ]);

  const completedTasks = tasks.filter((task) => task.completed);
  const plannedMinutes = tasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const completedMinutes = completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const clear = sessions.filter((item) => item.selfAssessment === "clear").length;
  const needsPractice = sessions.filter((item) => item.selfAssessment === "needs_practice").length;
  const blocked = sessions.filter((item) => item.selfAssessment === "blocked").length;
  const scored = practices.filter((item) => item.totalScore != null && item.maxScore && item.maxScore > 0);
  const averageRate = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.totalScore || 0) / (item.maxScore || 1), 0) / scored.length * 100)
    : null;
  const taskRate = tasks.length ? completedTasks.length / tasks.length : 0;
  const reviewReady = !milestone.completedAt
    && tasks.length > 0
    && taskRate >= 0.8
    && (sessions.length > 0 || practices.length > 0 || milestone.progress >= 0.75);

  return {
    tasks: { total: tasks.length, completed: completedTasks.length, plannedMinutes, completedMinutes },
    learning: { sessions: sessions.length, minutes: sessions.reduce((sum, item) => sum + (item.actualMinutes || 0), 0), clear, needsPractice, blocked },
    practice: { completed: practices.length, scored: scored.length, averageRate },
    wrongQuestions: { reviewed: reviewedWrongQuestions },
    reviewReady,
    prompt: reviewReady
      ? "执行证据已经较充分，可以结合练习、自评与错题复盘后确认下一步。"
      : "继续积累任务、学习会话或练习证据；完成任务本身不等于掌握。",
  };
}
