/**
 * AI 技能模板 — 内置示例技能（首次访问 /skills 时惰性播种为每个用户自己的行，可编辑/删除）。
 *
 * 技能 = 用户自定义的完整流程：数据快照 + 中途提问 + AI 指令 + 追加档案 + 收尾。
 * 执行引擎是 /api/ai/chat 的「curated chat mode」（技能 = 带 skillId 的对话）。
 */

// ── 步骤类型（V1）──

export type SkillDataSource =
  | "tasks.today"
  | "tasks.week"
  | "checkins.recent7"
  | "checkins.week"
  | "wrongQuestions.recent"
  | "wrongQuestions.due"
  | "goal"
  | "weeklyStats"
  | "practice.recent";

export interface SkillDataStep {
  type: "data";
  sources: SkillDataSource[];
}
export interface SkillAskStep {
  type: "ask";
  question: string;
}
export interface SkillAiStep {
  type: "ai";
  instruction: string;
}
export interface SkillNoteStep {
  type: "note";
  action: "append";
  label?: string;
}
export interface SkillFinishStep {
  type: "finish";
}

export type SkillStep =
  | SkillDataStep
  | SkillAskStep
  | SkillAiStep
  | SkillNoteStep
  | SkillFinishStep;

// ── 模板 ──

export interface SkillTemplate {
  name: string;
  description: string;
  icon: string;
  triggerKeywords: string[];
  steps: SkillStep[];
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    name: "每日复盘",
    description: "看看今天学了什么、状态如何，AI 帮你输出复盘和明天的重点，并记入成长档案。",
    icon: "🌅",
    triggerKeywords: ["复盘", "今天学了什么", "总结今天", "今日总结", "回顾今天", "今天的复盘"],
    steps: [
      { type: "data", sources: ["tasks.today", "checkins.recent7"] },
      {
        type: "ask",
        question: "今天学的怎么样？一句话说说感受，或给自己打个分（1-5）。",
      },
      {
        type: "ai",
        instruction:
          "基于今日任务、最近 7 天打卡数据和用户的回答，输出 3 句简洁的今日复盘（基于真实数据的总结 + 一个具体事实肯定），并给出明天最重要的 1 个重点任务建议。语气温和，不要大而全。",
      },
      { type: "note", action: "append", label: "每日复盘" },
      { type: "finish" },
    ],
  },
  {
    name: "错题变式训练",
    description: "从最近的错题里挑几道，AI 现场出同考点的变式题，做完逐题判分讲解。",
    icon: "🎯",
    triggerKeywords: ["错题", "变式", "错题训练", "巩固错题", "再做做错题", "练错题"],
    steps: [
      { type: "data", sources: ["wrongQuestions.recent"] },
      {
        type: "ask",
        question: "想练哪个科目？（不填就从最近错题里随机挑）",
      },
      {
        type: "ai",
        instruction:
          "从最近的错题中挑 2-3 道，分别出 1 道同考点的变式题（换数字、换问法、换情境），让用户现场做。做完后逐题判分，并讲解每道题的关键易错点。",
      },
      { type: "finish" },
    ],
  },
  {
    name: "费曼抽查",
    description: "抽一个最近学的知识点，你用大白话讲一遍，AI 找理解漏洞并补强，记录抽查档案。",
    icon: "💬",
    triggerKeywords: ["费曼", "抽查", "讲一遍", "知识掌握", "查漏", "讲给我听"],
    steps: [
      { type: "data", sources: ["wrongQuestions.recent"] },
      {
        type: "ask",
        question: "想抽查哪个知识点？（不填就随机抽一个最近学到的）",
      },
      {
        type: "ai",
        instruction:
          "挑一个知识点，让用户用大白话（费曼学习法）讲一遍。听完后：先具体肯定讲对的部分，再指出理解漏洞或盲区，最后用一个简单例子补强。",
      },
      { type: "note", action: "append", label: "费曼抽查" },
      { type: "finish" },
    ],
  },
];
