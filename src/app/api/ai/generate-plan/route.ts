import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJsonArray } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { normalizeSubject } from "@/lib/subject-standards";

interface PlanTask {
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD
  duration: number;  // 分钟
  phase: string;
  subject: string;
}

// ── 本地生成周计划（无需 AI Key）──
function generateLocalWeeklyPlan(
  subjects: string[],
  examDate: Date,
  weekStart: Date
): PlanTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

  // 计算当前周属于哪个阶段
  const daysPassed = Math.max(0, Math.ceil((weekStart.getTime() - today.getTime()) / 86400000));
  const progress = totalDays > 0 ? daysPassed / totalDays : 0;
  let phase: string;
  if (progress < 0.4) phase = "基础阶段";
  else if (progress < 0.75) phase = "强化阶段";
  else phase = "冲刺阶段";

  const tasks: PlanTask[] = [];

  // 每天生成 3-5 个学习会话，科目轮转
  const sessionTemplates: { title: string; desc: string; duration: number }[] = [
    { title: "{subject} - 教材精读", desc: "精读{subject}教材相关章节，做好笔记标注重点", duration: 90 },
    { title: "{subject} - 课后习题", desc: "完成{subject}课后练习题，标记不确定的题目", duration: 60 },
    { title: "{subject} - 视频课程", desc: "观看{subject}网课视频，整理思维导图", duration: 90 },
    { title: "{subject} - 真题训练", desc: "完成{subject}历年真题相关题目，计时作答", duration: 120 },
    { title: "{subject} - 错题回顾", desc: "复习{subject}错题本中的题目，确保已掌握", duration: 45 },
    { title: "{subject} - 专项突破", desc: "针对{subject}薄弱知识点进行专项练习", duration: 60 },
    { title: "{subject} - 进度检测", desc: "完成{subject}本章/本单元自测试卷，评估掌握程度", duration: 90 },
    { title: "{subject} - 背诵记忆", desc: "背诵{subject}核心知识点/公式/概念，建议用记忆卡片", duration: 45 },
  ];

  let templateIdx = 0;
  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart.getTime() + d * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // 每天 3-5 个任务（周末 3 个）
    const tasksToday = isWeekend ? 3 : Math.min(4 + Math.floor(d / 3), subjects.length * 2);

    for (let i = 0; i < tasksToday; i++) {
      const subject = subjects[(d + i) % subjects.length];
      const tpl = sessionTemplates[templateIdx % sessionTemplates.length];
      templateIdx++;

      tasks.push({
        title: tpl.title.replace("{subject}", subject),
        description: tpl.desc.replace("{subject}", subject),
        date: dateStr,
        duration: tpl.duration,
        phase,
        subject,
      });
    }

    // 周日加复盘
    if (date.getDay() === 0) {
      tasks.push({
        title: "本周复盘与总结",
        description: `回顾本周所有科目的学习进度，标记薄弱环节，整理错题本；规划下周学习重点`,
        date: dateStr,
        duration: 60,
        phase,
        subject: subjects[0],
      });
    }
  }

  return tasks;
}

// ── 计算阶段名称 ──
function getPhase(examDate: Date, targetDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));
  const daysPassed = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / 86400000));
  const progress = totalDays > 0 ? daysPassed / totalDays : 0;

  if (progress < 0.4) return "基础阶段";
  if (progress < 0.75) return "强化阶段";
  return "冲刺阶段";
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const weekStartDate = body.startDate
      ? new Date(body.startDate)
      : new Date();

    // Normalize to start of day
    weekStartDate.setHours(0, 0, 0, 0);

    // 获取用户目标
    const goal = await prisma.goal.findUnique({
      where: { userId: user!.id },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "请先设置考研目标" },
        { status: 400 }
      );
    }

    const examDate = new Date(goal.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

    // 周范围：从 weekStartDate 开始的 7 天
    const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000);
    const weekStartStr = weekStartDate.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // ── 增量模式：只删除本周范围内的未完成任务 ──
    // 保留：已完成任务 + 过去日期的任务 + 用户手动添加的任务
    await prisma.task.deleteMany({
      where: {
        userId: user!.id,
        completed: false,
        date: { gte: weekStartDate, lt: weekEnd },
        // 不删除手动添加的任务（source === 'manual' 或没有 phase 标记）
        phase: { not: null },
      },
    });

    const subjects = (Array.isArray(goal.subjects) ? goal.subjects : [])
      .map(normalizeSubject)
      .filter(Boolean);

    if (subjects.length === 0) {
      return NextResponse.json(
        { error: "请先设置考试科目" },
        { status: 400 }
      );
    }

    const aiConfig = await getUserAiConfig(user!.id);
    let planTasks: PlanTask[];

    if (aiConfig) {
      const targetScores = (goal.targetScores as Record<string, number>) || {};
      const scoreContext = Object.keys(targetScores).length > 0
        ? `\n- 目标分数：${Object.entries(targetScores).map(([k, v]) => `${k}: ${v}分`).join("、")}`
        : "";

      const prompt = `你是一名资深的考研辅导专家。请为用户的接下来一周（${weekStartStr} 至 ${weekEndStr}）生成详细的学习计划。

## 用户目标
- 目标院校：${goal.university}
- 目标专业：${goal.major}
- 考试日期：${goal.examDate.toISOString().split("T")[0]}
- 距考试还有：${daysRemaining} 天
- 考试科目：${subjects.join("、")}${scoreContext}

## 要求
1. 当前阶段判定：距考试 ${daysRemaining} 天，属于"${getPhase(examDate, weekStartDate)}"
2. 每天安排 **3-5 个**具体可执行的学习任务，总时长控制在 3-6 小时
3. 科目要交叉搭配，同一天不要全部安排同一科目
4. 周末安排复盘 + 错题回顾
5. 任务要具体，例如"完成多元函数微分学课后习题并订正"而非"做数学题"
6. 每个任务包含：title(标题)、description(详细描述)、date(YYYY-MM-DD)、duration(分钟数, 30-180之间)、phase(阶段名)、subject(科目名)

## 输出格式
只返回 JSON 数组，不含其他内容：
[{
  "title": "高数 - 完成多元函数微分学课后习题",
  "description": "完成课后 1-20 题，重点掌握链式法则和隐函数求导，整理错题到错题本",
  "date": "${weekStartStr}",
  "duration": 90,
  "phase": "${getPhase(examDate, weekStartDate)}",
  "subject": "数学一"
}]`;

      try {
        const result = await callAI(aiConfig, {
          messages: [
            { role: "system", content: "你是一个考研辅导专家，擅长制定详细、可执行的周学习计划。你只返回 JSON 数组，不返回其他内容。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          maxTokens: 16384,
        });

        const fullContent = result.text || result.reasoningText || "";
        console.log("AI weekly plan response length:", fullContent.length);

        const parsed = extractJsonArray<PlanTask>(fullContent);
        if (parsed && parsed.length > 0) {
          planTasks = parsed;
        } else {
          console.error("AI 返回格式不正确，前200字:", fullContent.substring(0, 200));
          throw new Error("AI 返回格式不正确");
        }
      } catch (e) {
        console.error("Plan generation AI fallback:", e instanceof Error ? e.message : String(e));
        planTasks = generateLocalWeeklyPlan(subjects, examDate, weekStartDate);
      }
    } else {
      planTasks = generateLocalWeeklyPlan(subjects, examDate, weekStartDate);
    }

    // 规范化 subject 名称
    planTasks = planTasks.map((t) => ({
      ...t,
      subject: normalizeSubject(t.subject),
      phase: t.phase || getPhase(examDate, new Date(t.date)),
    }));

    // 批量创建任务
    const created = await Promise.all(
      planTasks.map((t) =>
        prisma.task.create({
          data: {
            userId: user!.id,
            title: t.title,
            description: t.description,
            date: new Date(t.date),
            duration: Math.min(Math.max(t.duration || 60, 15), 480),
            phase: t.phase,
            subject: t.subject,
          },
        }).catch(() => null) // skip duplicates
      )
    );

    const succeeded = created.filter(Boolean);

    // 统计
    const phaseStats: Record<string, number> = {};
    for (const t of planTasks) {
      phaseStats[t.phase] = (phaseStats[t.phase] || 0) + 1;
    }

    return NextResponse.json({
      tasks: succeeded,
      totalTasks: succeeded.length,
      planned: planTasks.length,
      daysRemaining,
      weekRange: { start: weekStartStr, end: weekEndStr },
      phases: phaseStats,
      generatedBy: aiConfig ? "ai" : "local",
    });
  } catch (err) {
    console.error("Generate plan error:", err);
    return NextResponse.json(
      { error: "生成计划失败，请稍后再试" },
      { status: 500 }
    );
  }
}
