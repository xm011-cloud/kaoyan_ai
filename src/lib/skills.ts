/**
 * AI 技能运行时库 — 播种 / 数据快照 / 流程 prompt / 档案 / AI 提议。
 * Round B/C 逐步填充；Round A 先做模板播种 + 档案摘要。
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { SKILL_TEMPLATES } from "@/lib/skill-templates";
import type { SkillStep, SkillDataSource } from "@/lib/skill-templates";
import { startOfDay, endOfDay, getWeekStart, getWeekEnd, toDateString, daysAgo } from "@/lib/date-utils";

// ── 模板播种（首次访问 /skills 或首次对话时惰性播种为用户自己的行）──

export async function ensureTemplatesSeeded(userId: string): Promise<void> {
  const count = await prisma.skill.count({ where: { userId } });
  if (count > 0) return;
  await prisma.skill.createMany({
    data: SKILL_TEMPLATES.map((t) => ({
      userId,
      name: t.name,
      description: t.description,
      icon: t.icon,
      triggerKeywords: JSON.stringify(t.triggerKeywords),
      steps: t.steps as unknown as object,
      note: {},
      source: "template",
    })),
    skipDuplicates: true,
  });
}

// ── 技能档案（note）─ 技能跨会话累积的状态 ──

export interface SkillNoteEntry {
  at: string;
  label?: string;
  content: string;
}
export interface SkillNote {
  entries?: SkillNoteEntry[];
  [key: string]: unknown;
}

/** 从技能 note JSON 提取档案摘要（供页面展示） */
export function getNoteSummary(note: unknown): { count: number; lastLabel?: string } {
  const n = note as SkillNote | null;
  const entries = Array.isArray(n?.entries) ? (n!.entries as SkillNoteEntry[]) : [];
  return {
    count: entries.length,
    lastLabel: entries[entries.length - 1]?.label,
  };
}

/** 解析 steps Json → 步骤数组（防御脏数据） */
export function parseSkillSteps(steps: unknown): SkillStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter(
    (s): s is SkillStep =>
      !!s &&
      typeof s === "object" &&
      typeof (s as { type?: unknown }).type === "string"
  );
}

// ── 技能运行：数据快照（把技能声明的数据源查询为文本块，注入 system prompt）──

export async function buildSkillDataSnapshot(
  userId: string,
  sources: SkillDataSource[]
): Promise<string> {
  const today = startOfDay(new Date());
  const endOfToday = endOfDay(new Date());
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);
  const lines: string[] = [];

  if (sources.includes("tasks.today") || sources.includes("tasks.week")) {
    const where = sources.includes("tasks.week")
      ? { gte: weekStart, lte: weekEnd }
      : { gte: today, lte: endOfToday };
    const tasks = await prisma.task.findMany({
      where: { userId, date: where },
      orderBy: { date: "asc" },
      select: { title: true, completed: true, duration: true, subject: true, phase: true, date: true },
    });
    const completed = tasks.filter((t) => t.completed).length;
    lines.push(`【任务】共 ${tasks.length} 项，完成 ${completed} 项：`);
    for (const t of tasks.slice(0, 20)) {
      lines.push(
        `- ${t.completed ? "[完成]" : "[未完成]"} ${t.title}${t.subject ? `（${t.subject}）` : ""}${t.duration ? ` ${t.duration}分钟` : ""}${t.phase ? ` [${t.phase}]` : ""}`
      );
    }
  }

  if (sources.includes("checkins.recent7") || sources.includes("checkins.week")) {
    const where = sources.includes("checkins.week")
      ? { gte: weekStart, lte: weekEnd }
      : { gte: daysAgo(6), lte: endOfToday };
    const checkins = await prisma.checkIn.findMany({
      where: { userId, date: where },
      orderBy: { date: "asc" },
      select: { date: true, duration: true, status: true, note: true },
    });
    const total = checkins.reduce((s, c) => s + c.duration, 0);
    const statusLabel: Record<string, string> = { good: "状态好", normal: "一般", tired: "疲惫" };
    lines.push(`【打卡】${checkins.length} 天，共 ${total} 分钟：`);
    for (const c of checkins.slice(0, 14)) {
      lines.push(`- ${toDateString(c.date)} ${c.duration}分钟 ${statusLabel[c.status] || c.status}${c.note ? `（${c.note}）` : ""}`);
    }
  }

  if (sources.includes("wrongQuestions.recent") || sources.includes("wrongQuestions.due")) {
    const where = sources.includes("wrongQuestions.due")
      ? { userId, reviewed: false, nextReviewDate: { lte: new Date() } }
      : { userId };
    const questions = await prisma.wrongQuestion.findMany({
      where,
      orderBy: sources.includes("wrongQuestions.due") ? { nextReviewDate: "asc" as const } : { createdAt: "desc" as const },
      take: 10,
      select: { subject: true, question: true, tags: true, reviewCount: true },
    });
    lines.push(`【错题】${sources.includes("wrongQuestions.due") ? "今日待复习" : "最近"} ${questions.length} 道：`);
    for (const q of questions) {
      lines.push(`- [${q.subject}] ${q.question.slice(0, 120)}${q.tags.length ? `（标签：${q.tags.join("、")}）` : ""}`);
    }
  }

  if (sources.includes("goal")) {
    const goal = await prisma.goal.findUnique({ where: { userId } });
    if (goal) {
      const daysRemaining = Math.max(1, Math.ceil((goal.examDate.getTime() - today.getTime()) / 86400000));
      lines.push(`【目标】${goal.university} ${goal.major} · ${toDateString(goal.examDate)} · 剩 ${daysRemaining} 天`);
      if (goal.subjects.length) lines.push(`科目：${goal.subjects.join("、")}`);
    } else {
      lines.push("【目标】用户还没有设置考研目标");
    }
  }

  if (sources.includes("weeklyStats")) {
    const [checkIns, tasks] = await Promise.all([
      prisma.checkIn.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
      prisma.task.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    ]);
    const totalMinutes = checkIns.reduce((s, c) => s + c.duration, 0);
    const taskCompleted = tasks.filter((t) => t.completed).length;
    lines.push(
      `【本周统计】打卡 ${checkIns.length} 天 · 共 ${totalMinutes} 分钟 · 任务完成 ${taskCompleted}/${tasks.length}`
    );
  }

  if (sources.includes("practice.recent")) {
    const sessions = await prisma.practiceSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { subject: true, type: true, totalScore: true, maxScore: true, createdAt: true },
    });
    lines.push(`【最近练习】${sessions.length} 场：`);
    for (const s of sessions) {
      lines.push(
        `- ${toDateString(s.createdAt)} ${s.subject} ${s.type === "mock" ? "模拟考" : "练习"} ${s.totalScore !== null && s.maxScore ? `${s.totalScore}/${s.maxScore}` : "进行中"}`
      );
    }
  }

  return lines.join("\n");
}

// ── 技能运行：流程 prompt（把步骤渲染成 AI 逐步执行的指令）──

export interface BuildSkillRunPromptOptions {
  name: string;
  description?: string;
  steps: SkillStep[];
  snapshot: string;
  noteDigest: string;
}

export function buildSkillRunPrompt({
  name,
  description,
  steps,
  snapshot,
  noteDigest,
}: BuildSkillRunPromptOptions): string {
  const parts: string[] = [];
  parts.push(`## 技能运行：${name}`);
  if (description) parts.push(`技能描述：${description}`);

  if (snapshot) {
    parts.push(`### 数据快照（已为你查询的真实数据，请基于它工作，不要编造）\n${snapshot}`);
  }

  const flowSteps = steps.filter((s) => s.type !== "data");
  const numbered = flowSteps.map((s, i) => {
    const n = i + 1;
    switch (s.type) {
      case "ask":
        return `${n}. 向用户提问：「${s.question}」。提出后停下，等用户回答再继续下一步。`;
      case "ai":
        return `${n}. ${s.instruction}`;
      case "note":
        return `${n}. 把本轮成果用 skill_control 工具（action=note_append）追加到技能档案${s.label ? `，标签「${s.label}」` : ""}。`;
      case "finish":
        return `${n}. 整个流程完成后，调用 skill_control 工具（action=finish）结束本次运行。`;
      default:
        return "";
    }
  }).filter(Boolean);

  parts.push(`### 流程（严格按顺序逐步执行）\n${numbered.join("\n")}`);
  parts.push(`### 执行规则
1. 本次运行由用户启动。开场先简短说明你要做什么，然后立即执行流程第 1 步。
2. 一次只推进一步：输出本步结果后停下等用户回复，再进入下一步。不要一次把整个流程跑完。
3. 不要照念步骤编号，用自然语言交流。
4. 用户中途说「结束技能」或明确表示放弃时，调用 skill_control（action=finish）收尾。
5. skill_control 只操作技能档案，不创建任务、不改学习数据。需要落地时仍走现有工具（如 propose_tasks 提案）。`);

  if (noteDigest) {
    parts.push(`### 当前技能档案（历史记录，供你了解已有进展）\n${noteDigest}`);
  }

  return parts.join("\n\n");
}

/** 从技能 note 提取档案摘要文本（最近 N 条，控制注入上下文） */
export function getNoteDigest(note: unknown, max = 10): string {
  const n = note as SkillNote | null;
  const entries = Array.isArray(n?.entries) ? (n!.entries as SkillNoteEntry[]) : [];
  if (entries.length === 0) return "";
  const recent = entries.slice(-max);
  const body = recent
    .map((e, i) => `${i + 1}. [${e.label || "记录"} ${(e.at || "").slice(0, 10)}] ${e.content.slice(0, 200)}`)
    .join("\n");
  return `共 ${entries.length} 条记录，最近 ${recent.length} 条：\n${body}`;
}

// ── 技能运行：档案读写 + 收尾 ──

export async function appendSkillNote(
  userId: string,
  skillId: string,
  content: string,
  label?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
  if (!skill) return { success: false, error: "技能不存在" };
  const note = skill.note as SkillNote | null;
  const entries = Array.isArray(note?.entries) ? (note!.entries as SkillNoteEntry[]) : [];
  entries.push({ at: new Date().toISOString(), label: label || undefined, content });
  const trimmed = entries.slice(-500);
  await prisma.skill.update({
    where: { id: skillId },
    data: { note: { ...(note || {}), entries: trimmed } as unknown as Prisma.InputJsonValue },
  });
  return { success: true, count: trimmed.length };
}

export async function skillFinish(
  userId: string,
  skillId: string
): Promise<{ success: boolean; usageCount?: number; error?: string }> {
  const skill = await prisma.skill.findFirst({ where: { id: skillId, userId } });
  if (!skill) return { success: false, error: "技能不存在" };
  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: { usageCount: { increment: 1 }, lastRunAt: new Date() },
  });
  return { success: true, usageCount: updated.usageCount };
}
