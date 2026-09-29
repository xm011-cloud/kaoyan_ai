/**
 * 学习闭环健康度：只聚合已经存在的学习证据，不推断掌握度，也不记录额外埋点。
 *
 * 这是发布后狗粮期的诊断面板：帮助判断用户停在任务、学习现场、理解记录、
 * 知识关联还是回顾环节。各步是累计覆盖率，不能解释为严格的因果转化漏斗。
 */

export type ClosureStageId =
  | "planned"
  | "taskCompleted"
  | "studied"
  | "understood"
  | "linked"
  | "reviewed";

export const CLOSURE_STAGES: { id: ClosureStageId; label: string; description: string }[] = [
  { id: "planned", label: "有学习任务", description: "至少创建一条任务" },
  { id: "taskCompleted", label: "完成任务", description: "至少明确完成一条任务" },
  { id: "studied", label: "完成课程 / 练习", description: "至少完成一次课程会话或练习会话" },
  { id: "understood", label: "留下理解", description: "至少保存一条理解、易错点或解题思路" },
  { id: "linked", label: "确认知识关联", description: "至少将一条理解记录显式关联知识节点" },
  { id: "reviewed", label: "完成回顾", description: "至少回顾一次理解记录或错题" },
];

export interface ClosureHealthActivity {
  hasTask: boolean;
  hasCompletedTask: boolean;
  hasCompletedStudy: boolean;
  hasUnderstanding: boolean;
  hasKnowledgeLink: boolean;
  hasReview: boolean;
}

export interface ClosureHealthStage {
  id: ClosureStageId;
  label: string;
  description: string;
  reached: number;
  total: number;
  rate: number;
  /** 已到上一环、但还没到当前环的用户数；第一环没有前置环。 */
  gapFromPrevious: number | null;
}

export interface ClosureHealthReport {
  computedAt: string;
  /** 有任务的用户数；所有比例都以此为样本，避免未激活用户稀释结论。 */
  learnerCount: number;
  /** 同时拥有六类证据的用户数；不表示六类行为都发生在同一题或同一任务上。 */
  completeEvidenceUsers: number;
  stages: ClosureHealthStage[];
}

function reaches(activity: ClosureHealthActivity, id: ClosureStageId): boolean {
  switch (id) {
    case "planned": return activity.hasTask;
    case "taskCompleted": return activity.hasCompletedTask;
    case "studied": return activity.hasCompletedStudy;
    case "understood": return activity.hasUnderstanding;
    case "linked": return activity.hasKnowledgeLink;
    case "reviewed": return activity.hasReview;
  }
}

export function buildClosureHealth(
  activities: ClosureHealthActivity[],
  now = new Date()
): ClosureHealthReport {
  const learners = activities.filter((activity) => activity.hasTask);
  const stages = CLOSURE_STAGES.map((stage, index) => {
    const reached = learners.filter((activity) => reaches(activity, stage.id)).length;
    const previous = index === 0 ? null : CLOSURE_STAGES[index - 1];
    const gapFromPrevious = previous
      ? learners.filter((activity) => reaches(activity, previous.id) && !reaches(activity, stage.id)).length
      : null;
    return {
      ...stage,
      reached,
      total: learners.length,
      rate: learners.length ? reached / learners.length : 0,
      gapFromPrevious,
    };
  });

  return {
    computedAt: now.toISOString(),
    learnerCount: learners.length,
    completeEvidenceUsers: learners.filter((activity) => CLOSURE_STAGES.every((stage) => reaches(activity, stage.id))).length,
    stages,
  };
}
