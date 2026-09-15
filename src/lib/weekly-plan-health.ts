import { prisma } from "@/lib/prisma";
import {
  addStudyDays,
  getStudyWeekRange,
  studyDateToUtc,
  toStudyDateString,
} from "@/lib/date-utils";

export type WeeklyPlanHealth = {
  weekStart: string;
  weekEnd: string;
  plan: { id: string; objective: string; plannedMinutes: number } | null;
  tasks: { completed: number; total: number; plannedMinutes: number };
  /** 只统计打卡时长，避免与课程会话等其他学习记录重复相加。 */
  checkInMinutes: number;
  /** 截至今天，按本周已过去天数计算的计划节奏；无周计划时为 null。 */
  expectedMinutes: number | null;
  capacityStatus: "unplanned" | "on_track" | "behind";
  evidence: { courseSessions: number; practiceSessions: number; wrongReviews: number };
  notices: string[];
  nextStep: { label: string; href: string };
};

/**
 * 计划健康度只解释本周执行状况，不写入计划也不推断“已掌握”。
 * 任务与打卡采用日期标签查询；学习证据采用实际发生时间查询。
 */
export async function getWeeklyPlanHealth(userId: string, now = new Date()): Promise<WeeklyPlanHealth> {
  const { start, end } = getStudyWeekRange(now);
  const weekStart = studyDateToUtc(start);
  const weekEndExclusive = studyDateToUtc(addStudyDays(end, 1));

  const [weeklyPlan, checkInSummary, evidences] = await Promise.all([
    prisma.weeklyPlan.findFirst({
      where: { userId, weekStart, status: "active" },
      orderBy: { version: "desc" },
      select: {
        id: true,
        objective: true,
        plannedMinutes: true,
        tasks: { select: { completed: true, duration: true } },
      },
    }),
    prisma.checkIn.aggregate({
      where: { userId, date: { gte: weekStart, lt: weekEndExclusive } },
      _sum: { duration: true },
    }),
    prisma.studyEvidence.findMany({
      where: { userId, status: "active", occurredAt: { gte: weekStart, lt: weekEndExclusive } },
      select: { kind: true },
    }),
  ]);

  const tasks = weeklyPlan?.tasks ?? await prisma.task.findMany({
    where: { userId, date: { gte: weekStart, lt: weekEndExclusive } },
    select: { completed: true, duration: true },
  });
  const taskSummary = tasks.reduce(
    (summary, task) => ({
      completed: summary.completed + (task.completed ? 1 : 0),
      total: summary.total + 1,
      plannedMinutes: summary.plannedMinutes + (task.duration ?? 0),
    }),
    { completed: 0, total: 0, plannedMinutes: 0 },
  );
  const evidence = evidences.reduce(
    (summary, item) => {
      if (item.kind === "course_session") summary.courseSessions++;
      if (item.kind === "practice_session") summary.practiceSessions++;
      if (item.kind === "wrong_review") summary.wrongReviews++;
      return summary;
    },
    { courseSessions: 0, practiceSessions: 0, wrongReviews: 0 },
  );
  const checkInMinutes = checkInSummary._sum.duration ?? 0;
  const studyToday = studyDateToUtc(toStudyDateString(now));
  const elapsedDays = Math.min(7, Math.max(1, Math.floor((studyToday.getTime() - weekStart.getTime()) / 86_400_000) + 1));
  const expectedMinutes = weeklyPlan
    ? Math.round((weeklyPlan.plannedMinutes * elapsedDays) / 7)
    : null;
  const capacityStatus = !weeklyPlan
    ? "unplanned"
    : checkInMinutes >= (expectedMinutes ?? 0) * 0.8
      ? "on_track"
      : "behind";
  const notices: string[] = [];
  if (!weeklyPlan) {
    notices.push("本周还没有已确认的周计划；先确定可执行容量，再安排任务。");
  } else if (capacityStatus === "behind") {
    notices.push(`已记录打卡时长低于当前节奏约 ${expectedMinutes ?? 0} 分钟；可先复盘原因，再生成调整草稿。`);
  }
  if (weeklyPlan && taskSummary.total === 0) {
    notices.push("这份周计划尚未关联可执行任务，需要补充今天的下一步。");
  } else if (taskSummary.total > 0 && elapsedDays >= 5 && taskSummary.completed < taskSummary.total) {
    notices.push(`还有 ${taskSummary.total - taskSummary.completed} 项任务未完成；调整时会保留已完成记录。`);
  }

  return {
    weekStart: start,
    weekEnd: end,
    plan: weeklyPlan
      ? { id: weeklyPlan.id, objective: weeklyPlan.objective, plannedMinutes: weeklyPlan.plannedMinutes }
      : null,
    tasks: taskSummary,
    checkInMinutes,
    expectedMinutes,
    capacityStatus,
    evidence,
    notices,
    nextStep: !weeklyPlan
      ? { label: "查看本周任务", href: `/tasks?week=${start}` }
      : taskSummary.total > 0 && taskSummary.completed === taskSummary.total
        ? { label: "复盘这一周", href: "/feedback#feedback-history" }
        : { label: "继续本周任务", href: `/tasks?week=${start}` },
  };
}
