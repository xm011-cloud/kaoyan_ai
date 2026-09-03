export interface StageSourceMilestone {
  phase: string;
  subject: string;
  targetDate?: string | Date | null;
}

export interface StageDefinition {
  key: string;
  title: string;
  order: number;
  objective: string;
  exitCriteria: string[];
  startDate: Date | null;
  endDate: Date | null;
}

const STAGE_TEMPLATES: Record<string, Omit<StageDefinition, "order" | "startDate" | "endDate">> = {
  目标探索与基础启动: {
    key: "explore",
    title: "目标探索与基础启动",
    objective: "在不虚构院校和考试范围的前提下，确认关键约束，同时启动低后悔成本的公共基础学习。",
    exitCriteria: ["明确考试年份或下一次复核时间", "确认已知科目与待定分支", "完成各科初始水平扫描", "校准每周可持续学习容量"],
  },
  基础巩固: {
    key: "foundation",
    title: "基础巩固",
    objective: "完成各科首轮系统学习，建立知识框架并具备独立完成基础题的能力。",
    exitCriteria: ["各科核心范围完成首轮学习", "基础题能够独立完成", "形成第一版知识结构与错题记录"],
  },
  强化提升: {
    key: "intensify",
    title: "强化提升",
    objective: "围绕薄弱模块和常见题型进行专题训练，提升知识迁移与综合解题能力。",
    exitCriteria: ["主要专题完成针对性训练", "薄弱知识点有可验证改善", "能够处理跨章节综合题"],
  },
  冲刺突破: {
    key: "sprint",
    title: "冲刺突破",
    objective: "通过真题和计时训练稳定得分能力，形成适合自己的答题节奏。",
    exitCriteria: ["完成约定数量的真题或模拟训练", "形成稳定的时间分配策略", "高频错误显著减少"],
  },
  查漏补缺: {
    key: "review",
    title: "查漏补缺",
    objective: "集中回收错题、记忆内容和最后薄弱点，保持稳定状态进入考试。",
    exitCriteria: ["高频错题完成回收", "重点记忆内容完成复习", "不再新增大范围学习内容"],
  },
};

function validDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildStageDefinitions(milestones: StageSourceMilestone[]): StageDefinition[] {
  const phases: string[] = [];
  for (const milestone of milestones) {
    if (milestone.phase && !phases.includes(milestone.phase)) phases.push(milestone.phase);
  }

  return phases.map((phase, order) => {
    const template = STAGE_TEMPLATES[phase] ?? {
      key: `stage-${order + 1}`,
      title: phase,
      objective: `完成${phase}阶段的核心学习内容，并达到对应里程碑要求。`,
      exitCriteria: ["完成本阶段全部关键里程碑", "对阶段成果进行一次复盘确认"],
    };
    const dates = milestones
      .filter((milestone) => milestone.phase === phase)
      .map((milestone) => validDate(milestone.targetDate))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      ...template,
      order,
      startDate: order === 0 ? new Date() : null,
      endDate: dates.at(-1) ?? null,
    };
  });
}
