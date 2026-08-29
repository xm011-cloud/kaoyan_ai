/**
 * 备考阶段推导 — 由"目标状态 + 距考试天数 + 科目完成度 + 课业容量"共同决定。
 *
 * 见 docs/architecture-decisions.md 阶段 0 / docs/completion-model.md。
 * 四段：探索（无目标）→ 基础（基础未完成或长线）→ 备考（基础完成 + 150-365 天）→ 冲刺（<150 天）。
 * "长线/紧迫"是节奏属性，不是阶段名——基础期在距考试 600 天是宽松、100 天是紧迫补基础。
 */

import type { SubjectProgress } from "@/lib/completion";
import { isFoundationDone } from "@/lib/completion";

export type PrepStageId = "explore" | "foundation" | "prep" | "sprint";

export interface PrepStage {
  id: PrepStageId;
  label: string;
  /** 紧迫度 0=宽松 1=正常 2=紧 3=爆冲 */
  urgency: 0 | 1 | 2 | 3;
  /** 阶段焦点（给用户看 / 给 AI 计划用） */
  focus: string;
  /** 一句话阶段文案 */
  hint: string;
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
      label: "探索期",
      urgency: 0,
      focus: "定方向 / 调研院校，或描述你想学什么，生成一份学习计划",
      hint: "还没设目标？可以先选方向、看看院校，或在计划页描述你想学什么",
    };
  }

  // 冲刺期：距考试 < 150 天（时间紧，无论基础与否都按冲刺节奏）
  if (daysToExam < SPRINT_DAYS) {
    const critical = daysToExam < 30;
    return {
      id: "sprint",
      label: "冲刺期",
      urgency: critical ? 3 : 2,
      focus: "真题计时、错题当日复盘、高频考点背诵、查漏补缺",
      hint: `距考试 ${daysToExam} 天，聚焦真题与查漏补缺`,
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
      label: "备考期",
      urgency: 1,
      focus: "3 阶段周计划 + 每日任务 + 错题闭环",
      hint: `距考试 ${daysToExam} 天，进入正式备考节奏`,
    };
  }

  // 基础期：长线（>365 天）或 基础未完成（150-365 天紧迫补基础）
  const longCycle = daysToExam > PREP_DAYS;
  return {
    id: "foundation",
    label: "基础期",
    urgency: longCycle ? 0 : 1,
    focus: weeklyHours
      ? `完成科目基础 + 跟课（每周可投入约 ${weeklyHours} 小时，按此容量排计划）`
      : "完成科目基础学习 + 跟课",
    hint: `距考试 ${daysToExam} 天 · 当前重点是完成科目基础${
      weeklyHours ? ` · 每周可投入约 ${weeklyHours} 小时` : " · 长线宽松节奏"
    }`,
  };
}

/** 阶段 → 计划的任务 phase 名（兼容现有任务 phase 字段） */
export function stageToPlanPhase(stageId: PrepStageId, daysToExam: number | null): string {
  switch (stageId) {
    case "sprint":
      return "冲刺阶段";
    case "prep":
      // 备考期仍按时间比例在 基础→强化 间推进
      if (daysToExam == null) return "基础阶段";
      const progress = daysToExam > 365 ? 0 : 1 - daysToExam / 365;
      return progress < 0.4 ? "基础阶段" : "强化阶段";
    case "foundation":
    case "explore":
      return "基础阶段";
  }
}
