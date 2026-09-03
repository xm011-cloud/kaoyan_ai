/**
 * 学习计划领域共享契约。
 *
 * 这是数据库迁移前的稳定边界。API、页面和未来 Prisma 模型应复用这些枚举，
 * 避免路线、阶段、周计划和任务各自维护不同字符串。
 * 详见 docs/planning-domain.md。
 */

export const GOAL_STATUSES = ["exploring", "tentative", "confirmed", "paused"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const PLAN_STATUSES = ["draft", "active", "paused", "completed", "superseded"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STAGE_STATUSES = ["pending", "active", "completed", "skipped"] as const;
export type PlanStageStatus = (typeof PLAN_STAGE_STATUSES)[number];

export const WEEKLY_PLAN_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type WeeklyPlanStatus = (typeof WEEKLY_PLAN_STATUSES)[number];

export const PLANNING_TASK_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "deferred",
  "cancelled",
] as const;
export type PlanningTaskStatus = (typeof PLANNING_TASK_STATUSES)[number];

export const PROFILE_FACT_SOURCES = [
  "user_statement",
  "self_assessment",
  "assessment",
  "behavior",
  "ai_inference",
] as const;
export type ProfileFactSource = (typeof PROFILE_FACT_SOURCES)[number];

export const PROFILE_FACT_STATUSES = ["proposed", "confirmed", "superseded", "expired", "rejected"] as const;
export type ProfileFactStatus = (typeof PROFILE_FACT_STATUSES)[number];
export type EvidenceConfidence = "low" | "medium" | "high";

export interface ProfileFact<T = unknown> {
  id?: string;
  key: string;
  value: T;
  source: ProfileFactSource;
  confidence: EvidenceConfidence;
  status: ProfileFactStatus;
  observedAt: string;
  reviewAt?: string | null;
  supersededBy?: string | null;
}

export interface GoalDraft {
  type: string;
  status: GoalStatus;
  direction?: string | null;
  university?: string | null;
  major?: string | null;
  examDate?: string | null;
  examYear?: number | null;
  subjects: string[];
  confirmedFields: string[];
  unresolvedFields: string[];
}

export interface StageDraft {
  key: string;
  title: string;
  order: number;
  objective: string;
  exitCriteria: string[];
  startDate?: string | null;
  endDate?: string | null;
  assumptions?: string[];
}

export interface StudyPathDraft {
  goalId?: string;
  title: string;
  strategy?: string;
  stages: StageDraft[];
  assumptions: string[];
  risks: string[];
}

export const TASK_ACTION_TYPES = [
  "manual",
  "practice",
  "wrong_review",
  "material_read",
  "pomodoro",
  "chat",
] as const;
export type TaskActionType = (typeof TASK_ACTION_TYPES)[number];

export interface PlanningTaskDraft {
  clientId: string;
  title: string;
  description?: string;
  date: string;
  duration: number;
  subject?: string;
  milestoneKey?: string;
  actionType: TaskActionType;
  actionPayload?: Record<string, unknown>;
}

export interface WeeklyPlanDraft {
  studyPathId?: string;
  stageKey: string;
  weekStart: string;
  objective: string;
  rationale: string;
  successCriteria: string[];
  plannedMinutes: number;
  tasks: PlanningTaskDraft[];
}

const STATUS_TRANSITIONS = {
  goal: {
    exploring: ["tentative", "confirmed", "paused"],
    tentative: ["exploring", "confirmed", "paused"],
    confirmed: ["tentative", "paused"],
    paused: ["exploring", "tentative", "confirmed"],
  },
  plan: {
    draft: ["active", "superseded"],
    active: ["paused", "completed", "superseded"],
    paused: ["active", "superseded"],
    completed: [],
    superseded: [],
  },
  weeklyPlan: {
    draft: ["active", "archived"],
    active: ["completed", "archived"],
    completed: ["archived"],
    archived: [],
  },
} as const;

export function canTransitionGoal(from: GoalStatus, to: GoalStatus): boolean {
  return (STATUS_TRANSITIONS.goal[from] as readonly GoalStatus[]).includes(to);
}

export function canTransitionPlan(from: PlanStatus, to: PlanStatus): boolean {
  return (STATUS_TRANSITIONS.plan[from] as readonly PlanStatus[]).includes(to);
}

export function canTransitionWeeklyPlan(from: WeeklyPlanStatus, to: WeeklyPlanStatus): boolean {
  return (STATUS_TRANSITIONS.weeklyPlan[from] as readonly WeeklyPlanStatus[]).includes(to);
}

export function legacyCompletedToTaskStatus(completed: boolean): PlanningTaskStatus {
  return completed ? "completed" : "planned";
}
