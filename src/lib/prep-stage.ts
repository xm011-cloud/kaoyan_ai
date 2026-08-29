/**
 * 备考阶段推导 — 由"目标状态 + 距考试天数 + 科目完成度 + 课业容量"共同决定。
 *
 * 见 docs/architecture-decisions.md 阶段 0 / docs/completion-model.md。
 * 四段：探索（无目标）→ 基础（基础未完成或长线）→ 备考（基础完成 + 150-365 天）→ 冲刺（<150 天）。
 * "长线/紧迫"是节奏属性，不是阶段名——基础期在距考试 600 天是宽松、100 天是紧迫补基础。
 *
 * 阶段以「配置」形式存在（D4 计划类型分发种子）：静态身份（label/planSpanHint/planPhase）
 * 集中在 STAGE_CONFIG，未来加计划类型 = 加一条配置；动态文案（focus/hint 含用户数据）仍在此计算。
 */

import type { SubjectProgress } from "@/lib/completion";
import { isFoundationDone } from "@/lib/completion";

export type PrepStageId = "explore" | "foundation" | "prep" | "sprint";

/** 阶段静态配置（D4 留口：加计划类型 = 加一条） */
export interface StageConfig {
  /** 阶段名 */
  label: string;
  /** 计划跨度提示：这个阶段生成本周计划会是什么样（给用户看 / 给 AI 计划参考） */
  planSpanHint: string;
  /** 默认任务 phase 名（prep 在 stageToPlanPhase 里按时间推进） */
  planPhase: string;
}

export const STAGE_CONFIG: Record<PrepStageId, StageConfig> = {
  explore: {
    label: "探索期",
    planSpanHint: "先描述你想学什么 → 本周生成一份探索性计划，边学边调整",
    planPhase: "基础阶段",
  },
  foundation: {
    label: "基础期",
    planSpanHint: "本周以打基础为主：跟课 / 教材精读 / 课后习题，节奏按你的每周容量排",
    planPhase: "基础阶段",
  },
  prep: {
    label: "备考期",
    planSpanHint: "本周按 3 阶段（基础→强化）推进：每日任务 + 错题闭环",
    planPhase: "基础阶段",
  },
  sprint: {
    label: "冲刺期",
    planSpanHint: "本周冲刺节奏：每天真题计时 + 错题当日复盘 + 背诵",
    planPhase: "冲刺阶段",
  },
};

export interface PrepStage {
  id: PrepStageId;
  label: string;
  /** 紧迫度 0=宽松 1=正常 2=紧 3=爆冲 */
  urgency: 0 | 1 | 2 | 3;
  /** 阶段焦点（给用户看 / 给 AI 计划用） */
  focus: string;
  /** 一句话阶段文案 */
  hint: string;
  /** 计划跨度提示（STAGE_CONFIG 注入） */
  planSpanHint: string;
}

export interface StageInput {
  examDate: string | Date | null;
  hasGoal: boolean;
  subjects?: string[];
  subjectProgress?: Record<string, SubjectProgress> | null;
  /** 每周可投入小时（课业标记） */
  weeklyHours?: number | null;
}

/** 冲刺/备考/基础的阶段边界（天） */
export const SPRINT_DAYS = 150; // < 150 天 = 冲刺
export const PREP_DAYS = 365; // 150-365 天 = 备考期（基础完成时）

export function derivePrepStage(input: StageInput): PrepStage {
  const { examDate, hasGoal, subjectProgress, subjects, weeklyHours } = input;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysToExam: number | null = null;
  if (examDate) {
    const d = new Date(examDate);
    if (!isNaN(d.getTime())) {
      daysToExam = Math.max(0, Math.ceil((d.getTime() - today.getTime()) / 86400000));
    }
  }

  // 探索期：还没定目标/日期 → 先定方向或描述需求
  if (!hasGoal || daysToExam == null) {
    return {
      id: "explore",
      label: STAGE_CONFIG.explore.label,
      urgency: 0,
      focus: "定方向 / 调研院校，或描述你想学什么，生成一份学习计划",
      hint: "还没设目标？可以先选方向、看看院校，或在计划页描述你想学什么",
      planSpanHint: STAGE_CONFIG.explore.planSpanHint,
    };
  }

  // 冲刺期：距考试 < 150 天（时间紧，无论基础与否都按冲刺节奏）
  if (daysToExam < SPRINT_DAYS) {
    const critical = daysToExam < 30;
    return {
      id: "sprint",
      label: STAGE_CONFIG.sprint.label,
      urgency: critical ? 3 : 2,
      focus: "真题计时、错题当日复盘、高频考点背诵、查漏补缺",
      hint: `距考试 ${daysToExam} 天，聚焦真题与查漏补缺`,
      planSpanHint: STAGE_CONFIG.sprint.planSpanHint,
    };
  }

  // 基础门科目 = 非政治/非管综（政治通常 7 月后才启动，不卡阶段）
  const gateSubjects = (subjects ?? []).filter(
    (s) => !s.includes("政治") && !s.includes("管综") && !s.includes("199")
  );
  const progress = subjectProgress ?? {};
  const gateEntries = gateSubjects.map((s) => progress[s]).filter(Boolean) as SubjectProgress[];
  // 无基础门科目进度 → 不卡阶段（避免"没填就永远基础期"）
  const foundationDone = gateEntries.length === 0 || gateEntries.every((p) => isFoundationDone(p));

  // 备考期：150-365 天 且 基础已完成
  if (daysToExam <= PREP_DAYS && foundationDone) {
    return {
      id: "prep",
      label: STAGE_CONFIG.prep.label,
      urgency: 1,
      focus: "3 阶段周计划 + 每日任务 + 错题闭环",
      hint: `距考试 ${daysToExam} 天，进入正式备考节奏`,
      planSpanHint: STAGE_CONFIG.prep.planSpanHint,
    };
  }

  // 基础期：长线（>365 天）或 基础未完成（150-365 天紧迫补基础）
  const longCycle = daysToExam > PREP_DAYS;
  return {
    id: "foundation",
    label: STAGE_CONFIG.foundation.label,
    urgency: longCycle ? 0 : 1,
    focus: weeklyHours
      ? `完成科目基础 + 跟课（每周可投入约 ${weeklyHours} 小时，按此容量排计划）`
      : "完成科目基础学习 + 跟课",
    hint: `距考试 ${daysToExam} 天 · 当前重点是完成科目基础${
      weeklyHours ? ` · 每周可投入约 ${weeklyHours} 小时` : " · 长线宽松节奏"
    }`,
    planSpanHint: STAGE_CONFIG.foundation.planSpanHint,
  };
}

/** 阶段 → 计划的任务 phase 名（兼容现有任务 phase 字段；默认名来自 STAGE_CONFIG） */
export function stageToPlanPhase(stageId: PrepStageId, daysToExam: number | null): string {
  switch (stageId) {
    case "sprint":
      return STAGE_CONFIG.sprint.planPhase;
    case "prep":
      // 备考期仍按时间比例在 基础→强化 间推进
      if (daysToExam == null) return STAGE_CONFIG.prep.planPhase;
      const progress = daysToExam > 365 ? 0 : 1 - daysToExam / 365;
      return progress < 0.4 ? "基础阶段" : "强化阶段";
    case "foundation":
    case "explore":
      return STAGE_CONFIG.foundation.planPhase;
  }
}
