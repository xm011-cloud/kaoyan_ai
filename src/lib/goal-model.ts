import type { GoalStatus } from "@/lib/planning-types";

export interface GoalLike {
  status?: string | null;
  direction?: string | null;
  university?: string | null;
  major?: string | null;
  examDate?: string | Date | null;
  subjects?: string[] | null;
}

export function isGoalStatus(value: unknown): value is GoalStatus {
  return value === "exploring" || value === "tentative" || value === "confirmed" || value === "paused";
}

export function hasConfirmedGoalShape(goal: GoalLike): boolean {
  return Boolean(goal.university?.trim() && goal.major?.trim() && goal.examDate && goal.subjects?.length);
}

export function deriveGoalStatus(goal: GoalLike): GoalStatus {
  if (goal.status === "paused") return "paused";
  if (hasConfirmedGoalShape(goal)) return "confirmed";
  if (goal.major?.trim() || goal.examDate || goal.subjects?.length) return "tentative";
  return "exploring";
}

export function getGoalLabel(goal: GoalLike): string {
  const detailed = [goal.university, goal.major].filter(Boolean).join(" · ");
  return detailed || goal.direction?.trim() || goal.major?.trim() || "目标探索中";
}

export function getGoalExamDate(goal: GoalLike): Date | null {
  if (!goal.examDate) return null;
  const date = new Date(goal.examDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDaysToGoal(goal: GoalLike, now = new Date()): number | null {
  const examDate = getGoalExamDate(goal);
  if (!examDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));
}
