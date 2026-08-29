/**
 * 用户激活漏斗 — 阶段 0 决策依据（docs/architecture-decisions.md 3.4）。
 *
 * 纯函数：给定一个用户的「各环节首触时间」，判定其到达了哪些漏斗阶段 + 首触时间。
 * 数据聚合在 `/api/admin/funnel` 路由完成，本模块不碰 Prisma，便于单独测试。
 *
 * 阶段定义：注册/激活 → 设目标 → 生成计划 → 首次打卡 → 配 AI → 用过深功能 → 7 日回访。
 */

export interface FunnelActivity {
  /** 注册时间 */
  createdAt: Date;
  /** 设目标（创建 Goal） */
  goalAt: Date | null;
  /** 生成计划（存在 source=ai/ai_confirmed 的任务） */
  planAt: Date | null;
  /** 任意任务首建（含手动，回访计算用） */
  firstTaskAt: Date | null;
  /** 首次打卡 */
  firstCheckinAt: Date | null;
  /** 配 AI（User.aiKey 非空；无时间戳，仅布尔） */
  hasAiKey: boolean;
  /** 练习首触 */
  practiceAt: Date | null;
  /** 错题本首触 */
  wrongQuestionAt: Date | null;
  /** 学习路径首触 */
  studyPathAt: Date | null;
  /** 运行过技能（Chat.skillId 非空） */
  skillRunAt: Date | null;
  /** 首次对话 */
  chatAt: Date | null;
  /** 上传资料 */
  materialAt: Date | null;
  /** 周报反馈 */
  feedbackAt: Date | null;
}

export type FunnelStageId =
  | "registered"
  | "goal"
  | "plan"
  | "checkin"
  | "ai"
  | "deep"
  | "return7";

export interface FunnelStageDef {
  id: FunnelStageId;
  label: string;
  description: string;
  /** 该阶段分母是否只统计注册满 N 天的用户（null = 全部用户） */
  eligibleDays?: number;
}

export const FUNNEL_STAGES: FunnelStageDef[] = [
  { id: "registered", label: "注册 / 激活", description: "完成注册并进入产品" },
  { id: "goal", label: "设目标", description: "创建目标（院校·日期·科目）" },
  {
    id: "plan",
    label: "生成计划",
    description: "AI 生成或被采纳的学习计划（有 ai/ai_confirmed 来源任务）",
  },
  { id: "checkin", label: "首次打卡", description: "至少完成一次学习打卡" },
  { id: "ai", label: "配 AI", description: "在设置页填写了自己的 AI Key" },
  {
    id: "deep",
    label: "用过深功能",
    description: "练习 / 错题本 / 技能运行 / 学习路径，任一",
  },
  {
    id: "return7",
    label: "7 日回访",
    description: "注册满 7 天后仍回来有过行为",
    eligibleDays: 7,
  },
];

const DAY_MS = 86400000;

function earliest(dates: (Date | null)[]): Date | null {
  const list = dates.filter((d): d is Date => !!d);
  if (!list.length) return null;
  return new Date(Math.min(...list.map((d) => d.getTime())));
}

function latest(dates: (Date | null)[]): Date | null {
  const list = dates.filter((d): d is Date => !!d);
  if (!list.length) return null;
  return new Date(Math.max(...list.map((d) => d.getTime())));
}

/** 深功能首触 = 练习 / 错题 / 技能运行 / 学习路径 最早 */
function deepFirstAt(a: FunnelActivity): Date | null {
  return earliest([a.practiceAt, a.wrongQuestionAt, a.skillRunAt, a.studyPathAt]);
}

/** 回访计算用的全部行为时间点 */
function allActivityDates(a: FunnelActivity): Date[] {
  return [
    a.goalAt,
    a.planAt,
    a.firstTaskAt,
    a.firstCheckinAt,
    a.practiceAt,
    a.wrongQuestionAt,
    a.skillRunAt,
    a.studyPathAt,
    a.chatAt,
    a.materialAt,
    a.feedbackAt,
  ].filter((d): d is Date => !!d);
}

export interface FunnelUserResult {
  /** 已到达的阶段（有序） */
  reached: FunnelStageId[];
  /** 各阶段首触时间；已到达但无时间戳（如配 AI）为 null，未到达无此键 */
  firstAt: Partial<Record<FunnelStageId, Date | null>>;
  /** 是否已注册满 7 天（return7 的样本资格） */
  returnEligible: boolean;
  /** 最近一次行为时间 */
  lastActivityAt: Date | null;
}

export function classifyUser(a: FunnelActivity, now = new Date()): FunnelUserResult {
  const reached: FunnelStageId[] = ["registered"];
  const firstAt: FunnelUserResult["firstAt"] = { registered: a.createdAt };

  if (a.goalAt) {
    reached.push("goal");
    firstAt.goal = a.goalAt;
  }
  if (a.planAt) {
    reached.push("plan");
    firstAt.plan = a.planAt;
  }
  if (a.firstCheckinAt) {
    reached.push("checkin");
    firstAt.checkin = a.firstCheckinAt;
  }
  if (a.hasAiKey) {
    reached.push("ai");
    firstAt.ai = null;
  }
  const deep = deepFirstAt(a);
  if (deep) {
    reached.push("deep");
    firstAt.deep = deep;
  }

  const lastActivityAt = latest(allActivityDates(a));
  const returnEligible = now.getTime() - a.createdAt.getTime() >= 7 * DAY_MS;
  const firstRevisit = earliest(
    allActivityDates(a).filter((d) => d.getTime() >= a.createdAt.getTime() + 7 * DAY_MS)
  );
  if (returnEligible && firstRevisit) {
    reached.push("return7");
    firstAt.return7 = firstRevisit;
  }

  return { reached, firstAt, returnEligible, lastActivityAt };
}

// ── 报告聚合 ──

export interface FunnelStageAgg {
  id: FunnelStageId;
  label: string;
  description: string;
  /** 达标人数 */
  reached: number;
  /** 样本人数（7 日回访 = 注册满 7 天的用户，其余 = 全部用户） */
  total: number;
  /** reached / total */
  rate: number;
  /** 上一阶段达标人数（用于算流失） */
  prevReached: number;
}

export interface FunnelUserRow {
  id: string;
  email: string;
  createdAt: string;
  lastActivityAt: string | null;
  returnEligible: boolean;
  reached: string[];
  /** stageId → 首触时间 ISO；已到达但无时间戳（如配 AI）→ null */
  firstAt: Record<string, string | null>;
}

export interface FunnelReport {
  computedAt: string;
  totalUsers: number;
  stages: FunnelStageAgg[];
  users: FunnelUserRow[];
}

export function buildFunnel(
  inputs: { id: string; email: string; activity: FunnelActivity }[],
  now = new Date()
): FunnelReport {
  const rows: FunnelUserRow[] = inputs.map((u) => {
    const r = classifyUser(u.activity, now);
    const firstAt: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(r.firstAt)) {
      firstAt[k] = v ? v.toISOString() : null;
    }
    return {
      id: u.id,
      email: u.email,
      createdAt: u.activity.createdAt.toISOString(),
      lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
      returnEligible: r.returnEligible,
      reached: r.reached,
      firstAt,
    };
  });

  const eligibleUsers = rows.filter((r) => r.returnEligible).length;

  const stages: FunnelStageAgg[] = FUNNEL_STAGES.map((s, i) => {
    const total = s.eligibleDays ? eligibleUsers : rows.length;
    const reached = rows.filter((r) => r.reached.includes(s.id)).length;
    const prevReached = i === 0 ? rows.length : rows.filter((r) => r.reached.includes(FUNNEL_STAGES[i - 1].id)).length;
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      reached,
      total,
      rate: total ? reached / total : 0,
      prevReached,
    };
  });

  return {
    computedAt: now.toISOString(),
    totalUsers: rows.length,
    stages,
    users: rows,
  };
}
