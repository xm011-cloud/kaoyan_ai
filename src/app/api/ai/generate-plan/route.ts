import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJsonArray, truncateReasoning } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { normalizeSubject } from "@/lib/subject-standards";
import { derivePrepStage, stageToPlanPhase } from "@/lib/prep-stage";
import { getEffectiveStage, STAGE_LABELS, needsConfirmation, type SubjectProgress } from "@/lib/completion";
import { addLocalDays, toLocalDateString } from "@/lib/date-utils";
import type { Prisma } from "@prisma/client";
import { applyWeeklyAdjustment, parseWeeklyAdjustment } from "@/lib/weekly-plan-adjustment";
import { formatStudyProfileFactsForPrompt, getPlanningReadiness } from "@/lib/study-profile";

interface PlanTask {
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD
  duration: number;  // 分钟
  phase: string;
  subject: string;
  milestoneId?: string;
  milestoneTitle?: string;
}

/** 探索期计划上下文（judge-plan-intent 确认后传入，无需落库 Goal） */
interface PlanContext {
  label?: string;
  subjects?: string[];
  examDate?: string;
}

interface StudyLoad {
  weeklyHours?: number;
  busyWeeks?: string[];
}

function generateMilestoneReviewTasks(
  milestone: { id: string; title: string; subject: string },
  outcome: "continue" | "relearn",
  weekStart: string,
  phase: string,
): PlanTask[] {
  const templates = outcome === "relearn"
    ? [
        { offset: 0, title: `重新梳理：${milestone.title}`, description: `回到教材或课程，重新建立「${milestone.title}」的概念、前提与知识框架。`, duration: 60 },
        { offset: 2, title: `基础练习：${milestone.title}`, description: `完成一组基础题，逐题记录不确定点，不以做完代替理解。`, duration: 60 },
        { offset: 5, title: `复述与复盘：${milestone.title}`, description: `用自己的话复述核心内容，回看错题与卡点，再决定是否继续巩固。`, duration: 45 },
      ]
    : [
        { offset: 0, title: `针对性练习：${milestone.title}`, description: `围绕「${milestone.title}」完成一组针对性练习，记录正确率和不确定题。`, duration: 60 },
        { offset: 3, title: `错题复习：${milestone.title}`, description: `重做当前里程碑关联错题，说明每道题的错误原因与正确思路。`, duration: 45 },
        { offset: 5, title: `巩固复盘：${milestone.title}`, description: `结合任务、练习和错题证据，判断当前里程碑是否达到退出标准。`, duration: 45 },
      ];
  return templates.map((item) => ({
    title: item.title,
    description: item.description,
    date: addLocalDays(weekStart, item.offset),
    duration: item.duration,
    phase,
    subject: milestone.subject,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
  }));
}

/** AI 输出只是一份候选草稿。先在服务端收紧其字段、日期和容量，再允许用户看见并确认。 */
function sanitizePlanTasks(
  tasks: PlanTask[],
  options: { subjects: string[]; phase: string; earliestDate: string; latestDate: string },
): PlanTask[] {
  return tasks.flatMap((task) => {
    if (!task || typeof task.title !== "string") return [];
    const date = String(task.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < options.earliestDate || date > options.latestDate) return [];
    const title = task.title.trim().slice(0, 160);
    if (!title) return [];
    const normalizedSubject = normalizeSubject(String(task.subject || ""));
    const subject = options.subjects.includes(normalizedSubject) ? normalizedSubject : options.subjects[0];
    const rawDuration = Number(task.duration);
    return [{
      title,
      description: typeof task.description === "string" && task.description.trim()
        ? task.description.trim().slice(0, 800)
        : `完成「${title}」并记录理解、疑问或下一步。`,
      date,
      duration: Math.min(Math.max(Number.isFinite(rawDuration) ? Math.round(rawDuration) : 60, 30), 180),
      phase: options.phase,
      subject,
    }];
  });
}

// ── 本地生成周计划（无需 AI Key）──
// weekStartStr 是本地历法周一日期串（"2026-08-24"），任务日期按本地日历日推进；
// 不能用 UTC 串（toISOString），否则 UTC+8 用户整体错位一天。
function generateLocalWeeklyPlan(
  subjects: string[],
  weekStartStr: string,
  opts: { phase: string; capacity: number | null; foundationMode: boolean; minDateStr?: string }
): PlanTask[] {
  const { phase, capacity, foundationMode, minDateStr } = opts;
  const tasks: PlanTask[] = [];

  // 冲刺模板：真题/错题/背诵优先
  const sprintTemplates: { title: string; desc: string; duration: number }[] = [
    { title: "{subject} - 真题计时", desc: "完成{subject}一套历年真题或模拟卷，严格计时作答并对照答案订正", duration: 120 },
    { title: "{subject} - 错题复盘", desc: "复习{subject}错题本中的题目，重做并归纳错误原因", duration: 60 },
    { title: "{subject} - 高频考点", desc: "专项突破{subject}历年高频考点，做针对性练习", duration: 90 },
    { title: "{subject} - 背诵记忆", desc: "背诵{subject}核心公式/概念/答题模板，用记忆卡片强化", duration: 60 },
  ];
  // 基础模板：跟课/教材/习题优先（阶段 0：基础期用）
  const foundationTemplates: { title: string; desc: string; duration: number }[] = [
    { title: "{subject} - 跟课学习", desc: "跟上{subject}的课程进度，整理本周课堂内容，标注没听懂的地方", duration: 90 },
    { title: "{subject} - 教材精读", desc: "精读{subject}教材相关章节，做好笔记标注重点", duration: 90 },
    { title: "{subject} - 课后习题", desc: "完成{subject}课后练习题，标记不确定的题目", duration: 60 },
    { title: "{subject} - 基础练习", desc: "做{subject}基础题型练习，巩固本周所学知识点", duration: 60 },
  ];
  // 常规模板
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
    const dateStr = addLocalDays(weekStartStr, d);
    // 本周今天以前已过去（按日期字符串比较，与前端周槽位口径一致）
    if (minDateStr && dateStr < minDateStr) continue;
    const dow = new Date(`${dateStr}T00:00:00`).getDay();
    const isWeekend = dow === 0 || dow === 6;

    // 容量：每周小时 → 每天约 hours/7 小时；按每任务约 45 分钟折算任务数
    const baseTasks = isWeekend ? 3 : Math.min(4 + Math.floor(d / 3), subjects.length * 2);
    const capTasks = capacity ? Math.max(1, Math.round((capacity / 7) * 1.5)) : baseTasks;
    const tasksToday = capacity ? Math.min(baseTasks, capTasks) : baseTasks;

    const pool = phase === "冲刺阶段" ? sprintTemplates : foundationMode ? foundationTemplates : sessionTemplates;

    for (let i = 0; i < tasksToday; i++) {
      const subject = subjects[(d + i) % subjects.length];
      const tpl = pool[templateIdx % pool.length];
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
    if (dow === 0) {
      tasks.push({
        title: "本周复盘与总结",
        description: "回顾本周所有科目的学习进度，标记薄弱环节，整理错题本；规划下周学习重点",
        date: dateStr,
        duration: 60,
        phase,
        subject: subjects[0],
      });
    }
  }

  return tasks;
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const weekStartDate = body.startDate || body.weekStartDate
      ? new Date(body.startDate || body.weekStartDate)
      : new Date();
    const progress = body.progress as Record<string, SubjectProgress> | undefined;
    const judgeFeedback = body.judgeFeedback as string | undefined;
    const regenerateDay = body.regenerateDay as string | undefined;
    const planContext = body.planContext as PlanContext | undefined;
    const generationMode = body.generationMode === "local" ? "local" : "auto";
    const adjustmentRequest = typeof body.adjustmentRequest === "string"
      ? body.adjustmentRequest.trim().slice(0, 1000)
      : "";
    const focusMilestoneId = typeof body.focusMilestoneId === "string" ? body.focusMilestoneId : "";
    const reviewOutcome = body.reviewOutcome === "continue" || body.reviewOutcome === "relearn"
      ? body.reviewOutcome
      : null;

    // 获取目标（可能没有 → 探索期用 planContext）
    const [goal, activeStage, profileFacts] = await Promise.all([
      prisma.goal.findUnique({ where: { userId: user!.id } }),
      prisma.studyPathStage.findFirst({
        where: { studyPath: { userId: user!.id, status: "active" }, status: "active" },
        include: {
          studyPath: { select: { id: true, title: true, subjects: true } },
          milestones: {
            where: { completedAt: null },
            orderBy: { order: "asc" },
            select: { id: true, title: true, subject: true },
          },
        },
        orderBy: { order: "asc" },
      }),
      prisma.studyProfileFact.findMany({
        where: { userId: user!.id, status: "confirmed" },
        orderBy: { observedAt: "desc" },
      }),
    ]);
    const studyLoad = (goal?.studyLoad as StudyLoad) || undefined;

    // ── 统一计划上下文：有 goal 用 goal，否则用 planContext（探索期）──
    let ctxLabel = "";
    let ctxExamDate: Date | null = null;
    let subjects: string[] = [];
    let targetScores: Record<string, number> = {};

    if (goal) {
      ctxLabel = [goal.university, goal.major].filter(Boolean).join(" · ") || goal.direction || "当前学习目标";
      ctxExamDate = goal.examDate;
      subjects = (Array.isArray(goal.subjects) ? goal.subjects : [])
        .map(normalizeSubject).filter(Boolean);
      if (subjects.length === 0 && activeStage?.studyPath.subjects.length) {
        subjects = activeStage.studyPath.subjects.map(normalizeSubject).filter(Boolean);
      }
      targetScores = (goal.targetScores as Record<string, number>) || {};
    } else if (planContext) {
      ctxLabel = planContext.label || "你的自定义学习计划";
      if (planContext.examDate) {
        const d = new Date(planContext.examDate);
        if (!isNaN(d.getTime())) ctxExamDate = d;
      }
      subjects = (Array.isArray(planContext.subjects) ? planContext.subjects : [])
        .map(normalizeSubject).filter(Boolean);
    } else {
      return jsonNoStore(
        { error: "请先设置考研目标，或在计划页描述你想学什么（生成自定义计划）" },
        { status: 400 }
      );
    }

    if (subjects.length === 0) {
      return jsonNoStore({ error: "请设置学习科目" }, { status: 400 });
    }
    const adjustmentConstraints = parseWeeklyAdjustment(adjustmentRequest, subjects);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = ctxExamDate
      ? Math.max(1, Math.ceil((ctxExamDate.getTime() - today.getTime()) / 86400000))
      : null;
    const weeklyHours = adjustmentConstraints.weeklyHours ?? studyLoad?.weeklyHours ?? null;
    const planningReadiness = getPlanningReadiness({
      examDate: ctxExamDate,
      examYear: goal?.examYear,
      university: goal?.university,
      major: goal?.major,
      subjects,
      weeklyHours,
    }, profileFacts);

    // ── 阶段推导（0.3）──
    const stage = derivePrepStage({
      examDate: ctxExamDate,
      hasGoal: !!goal,
      subjects,
      subjectProgress: progress,
      weeklyHours,
    });
    const phase = activeStage?.title ?? stageToPlanPhase(stage.id, daysRemaining);
    const foundationMode = activeStage
      ? activeStage.key === "foundation" || activeStage.key === "explore"
      : stage.id === "foundation" || stage.id === "explore";
    const focusMilestone = focusMilestoneId
      ? activeStage?.milestones.find((milestone) => milestone.id === focusMilestoneId) ?? null
      : null;
    if (focusMilestoneId && !focusMilestone) {
      return jsonNoStore({ error: "当前阶段中没有需要调整的这个里程碑" }, { status: 400 });
    }

    // 周范围（用本地历法日期串：weekStartLocal 来自前端本地周一，避免 UTC 串错位一天）
    const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000);
    const weekStartStr = (body.weekStartLocal as string) || toLocalDateString(weekStartDate);
    // 本周今天以前已过去，不生成任务（前端传"本地今天"字符串，与周槽位口径一致）
    const todayLocalStr = (body.todayLocal as string) || toLocalDateString(today);
    const weekLastStr = addLocalDays(weekStartStr, 6); // 本周最后一天（周日槽位）
    const pastSkip = todayLocalStr > weekStartStr;

    const aiConfig = await getUserAiConfig(user!.id);
    let planTasks: PlanTask[];
    let planReasoning: string | undefined;

    const keepProfileLocal = profileFacts.length > 0 && activeStage?.key === "explore";
    if (aiConfig && generationMode !== "local" && !keepProfileLocal) {
      const scoreContext = Object.keys(targetScores).length > 0
        ? `\n- 目标分数：${Object.entries(targetScores).map(([k, v]) => `${k}: ${v}分`).join("、")}`
        : "";

      // 进度上下文（保守：档位未确认 → 优先基础巩固）
      let progressContext = "";
      if (progress && Object.keys(progress).length > 0) {
        progressContext = "\n## 用户当前学习状态（保守：自评可能偏高）\n";
        for (const [subj, p] of Object.entries(progress)) {
          const pp = p as SubjectProgress;
          const eff = getEffectiveStage(pp);
          const conf = needsConfirmation(pp) ? "（未确认，保守对待）" : "（已确认）";
          progressContext += `- ${subj}：档位 ${STAGE_LABELS[eff]}${conf} · 参考进度 ${pp.percent ?? 0}%${pp.note ? `（${pp.note}）` : ""}\n`;
        }
        progressContext += "对用户自评持保守态度：档位未确认时，优先安排基础巩固而不是强化/冲刺内容。\n";
      }

      let feedbackContext = "";
      if (judgeFeedback) {
        feedbackContext = `\n## 上次评审反馈\n${judgeFeedback}\n请根据以上反馈调整本次生成的内容。\n`;
      }

      const regenerateContext = regenerateDay
        ? `\n## 注意\n只需要生成 ${regenerateDay} 这一天的任务（3-5个），不要生成其他日期。\n`
        : "";
      const adjustmentContext = adjustmentRequest
        ? `\n## 用户本周调整要求（必须遵守）\n${adjustmentRequest}\n不要自行扩大要求的影响范围；只调整本周尚未开始的安排。\n`
        : "";

      // 本周今天以前已过去，不要生成过去的任务；也不要超出本周
      const pastSkipContext = pastSkip
        ? `\n## 注意（重要）\n今天是 ${todayLocalStr}，本周任务是 ${todayLocalStr} 至 ${weekLastStr}。**只生成这个范围内的任务**：不要生成过去的日期，也不要超出本周（不要排到 ${weekLastStr} 之后）。\n`
        : "";

      // 冲刺模式指令
      const sprintContext = stage.id === "sprint"
        ? `\n## 冲刺模式（距考试 ${daysRemaining} 天）\n1. 每天安排 1 套真题或模拟卷计时作答（至少 90 分钟整卷）\n2. 所有错题当天复盘并整理进错题本\n3. 记忆/背诵类任务占比提高到 40% 以上\n4. 减少新知识学习，聚焦高频考点、查漏补缺与应试技巧\n`
        : "";

      // 课业容量
      const capacityContext = weeklyHours
        ? `\n## 可投入时间\n用户还在上课/有其他安排，每周大约可投入 ${weeklyHours} 小时（约每天 ${Math.round((weeklyHours / 7) * 10) / 10} 小时）。每天任务总时长请控制在这个容量内，任务数宁少勿多。\n`
        : "";

      const goalBlock = ctxExamDate
        ? `- 目标：${ctxLabel}\n- 考试日期：${ctxExamDate.toISOString().split("T")[0]}\n- 距考试还有：${daysRemaining} 天\n- 科目：${subjects.join("、")}${scoreContext}`
        : `- 目标：${ctxLabel}（未设定考试日期，按宽松节奏安排）\n- 科目：${subjects.join("、")}${scoreContext}`;
      const profileContext = `\n## 已确认长期学习档案\n${formatStudyProfileFactsForPrompt(profileFacts)}\n路线草稿准备度：${planningReadiness.readyForPathDraft ? "已满足" : `尚缺：${planningReadiness.unresolvedFields.join("、")}`}\n`;

      const durationGuidance = weeklyHours
        ? `每天任务总时长控制在 ${Math.round(weeklyHours / 7)} 小时左右（不超 ${Math.round(weeklyHours / 7) + 1} 小时）`
        : "每天任务总时长控制在 3-6 小时";

      const stageFocusContext = activeStage
        ? `\n## 当前正式阶段\n${activeStage.title}。阶段目标：${activeStage.objective}。本周任务必须服务于这个阶段目标，任务 phase 统一用「${phase}」。\n本阶段尚未完成的里程碑：${activeStage.milestones.map((item) => `${item.subject}·${item.title}`).join("；") || "暂无，先围绕阶段退出标准安排"}。\n`
        : `\n## 当前备考阶段\n${stage.label}（${stage.hint}）。本阶段焦点：${stage.focus}。本周计划跨度提示：${stage.planSpanHint}。任务 phase 统一用「${phase}」。\n`;

      const prompt = `你是一名资深的考研/学习辅导专家。请为用户的接下来一周（${weekStartStr} 至 ${weekEnd.toISOString().split("T")[0]}）生成详细的学习计划。

## 用户目标
${goalBlock}
${progressContext}${feedbackContext}${capacityContext}${stageFocusContext}${profileContext}${adjustmentContext}
## 要求
1. 当前阶段判定：${stage.label}，任务 phase 统一用「${phase}」
2. 每天安排 **3-5 个**具体可执行的学习任务，${durationGuidance}
3. 科目要交叉搭配，同一天不要全部安排同一科目
4. 周末安排复盘 + 错题回顾
5. 任务要具体，例如"完成多元函数微分学课后习题并订正"而非"做数学题"
6. 每个任务包含：title(标题)、description(详细描述)、date(YYYY-MM-DD)、duration(分钟数, 30-180之间)、phase(阶段名)、subject(科目名)
${sprintContext}${regenerateContext}${pastSkipContext}
## 输出格式
只返回 JSON 数组，不含其他内容：
[{
  "title": "高数 - 完成多元函数微分学课后习题",
  "description": "完成课后 1-20 题，重点掌握链式法则和隐函数求导，整理错题到错题本",
  "date": "${regenerateDay || weekStartStr}",
  "duration": 90,
  "phase": "${phase}",
  "subject": "数学一"
}]`;

      try {
        const result = await callAI(aiConfig, {
          messages: [
            { role: "system", content: "你是一个考研/学习辅导专家，擅长制定详细、可执行的周学习计划。你只返回 JSON 数组，不返回其他内容。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          maxTokens: 16384,
        });

        const fullContent = result.text || result.reasoningText || "";
        console.log("AI plan response length:", fullContent.length);

        const parsed = extractJsonArray<PlanTask>(fullContent);
        if (parsed && parsed.length > 0) {
          planTasks = parsed;
          planReasoning = result.reasoningText || undefined;
        } else {
          console.error("AI 返回格式不正确，前200字:", fullContent.substring(0, 200));
          throw new Error("AI 返回格式不正确");
        }
      } catch (e) {
        console.error("Plan generation AI fallback:", e instanceof Error ? e.message : String(e));
        planTasks = generateLocalWeeklyPlan(subjects, weekStartStr, { phase, capacity: weeklyHours, foundationMode, minDateStr: todayLocalStr });
      }
    } else {
      planTasks = generateLocalWeeklyPlan(subjects, weekStartStr, { phase, capacity: weeklyHours, foundationMode, minDateStr: todayLocalStr });
    }

    if (focusMilestone && reviewOutcome) {
      // 复盘后的下周草稿只围绕用户刚确认的结论展开，不让通用模板稀释“继续巩固/需要重学”。
      planTasks = generateMilestoneReviewTasks(focusMilestone, reviewOutcome, weekStartStr, phase);
    }

    // 规范化 + 添加周标识；并对 AI 返回的任务做日期清洗：
    // 只保留本周可见范围 [今天, 周日] —— 剔除 AI 生成的过去日期与越界到下周的任务
    planTasks = sanitizePlanTasks(planTasks, {
      subjects,
      phase,
      earliestDate: todayLocalStr,
      latestDate: weekLastStr,
    });
    // 模型返回全是过期/非法日期时，不能悄悄生成空计划；回退到同一套本地安全模板。
    if (planTasks.length === 0 && !regenerateDay) {
      planTasks = sanitizePlanTasks(
        generateLocalWeeklyPlan(subjects, weekStartStr, { phase, capacity: weeklyHours, foundationMode, minDateStr: todayLocalStr }),
        { subjects, phase, earliestDate: todayLocalStr, latestDate: weekLastStr },
      );
    }

    // 单日重排仍然产生“完整周草稿”：保留当前生效计划中其他日期的未完成任务，
    // 只替换用户指定日期，避免确认后整周只剩一天。
    if (regenerateDay) {
      const retained = await prisma.task.findMany({
        where: {
          userId: user!.id,
          weeklyPlan: { weekStart: new Date(weekStartStr), status: "active" },
          completed: false,
          date: { gte: new Date(todayLocalStr), lte: new Date(weekLastStr) },
          NOT: {
            date: {
              gte: new Date(`${regenerateDay}T00:00:00`),
              lte: new Date(`${regenerateDay}T23:59:59.999`),
            },
          },
        },
      });
      planTasks = [
        ...retained.map((task) => ({
          title: task.title,
          description: task.description ?? "",
          date: toLocalDateString(task.date),
          duration: task.duration ?? 60,
          phase: task.phase ?? phase,
          subject: task.subject ?? subjects[0],
        })),
        ...planTasks,
      ].sort((a, b) => a.date.localeCompare(b.date));
    }

    if (adjustmentRequest || weeklyHours) {
      // 无论计划来自 AI 还是本地模板，每周容量都由服务端强制执行；模型不能用“看起来合理”的任务绕过容量约束。
      planTasks = applyWeeklyAdjustment(planTasks, { ...adjustmentConstraints, weeklyHours }, weekStartStr);
    }

    // AI 只负责生成可执行任务；里程碑关联由服务端按当前活动阶段和科目确定，
    // 避免模型伪造 ID，也让本地兜底计划拥有同样的可追溯性。
    if (activeStage?.milestones.length) {
      const nextIndexBySubject = new Map<string, number>();
      planTasks = planTasks.map((task) => {
        if (focusMilestone) return { ...task, milestoneId: focusMilestone.id, milestoneTitle: focusMilestone.title };
        if (task.milestoneId) return task;
        const candidates = activeStage.milestones.filter((item) => item.subject === task.subject);
        // 当前阶段没有同科目里程碑时保持未归属；跨科轮流塞入会制造看似完整、实则错误的路线证据。
        if (candidates.length === 0) return task;
        const index = nextIndexBySubject.get(task.subject) ?? 0;
        const milestone = candidates[index % candidates.length];
        nextIndexBySubject.set(task.subject, index + 1);
        return { ...task, milestoneId: milestone.id, milestoneTitle: milestone.title };
      });
    }

    const plannedMinutes = planTasks.reduce(
      (total, task) => total + Math.min(Math.max(task.duration || 60, 15), 480),
      0,
    );
    const objective = activeStage?.objective
      ?? `围绕${phase}推进${subjects.slice(0, 3).join("、")}，形成可复盘的一周学习闭环。`;
    const profileBasis = keepProfileLocal ? `，并在本地参考 ${profileFacts.length} 条已确认学习档案` : "";
    const rationale = activeStage
      ? `本周计划来自长期路线「${activeStage.studyPath.title}」的当前阶段「${activeStage.title}」，并结合每周容量${weeklyHours ? ` ${weeklyHours} 小时` : "与当前科目进度"}${profileBasis}安排。`
      : `当前还没有已确认的正式阶段，本草稿依据目标信息、科目进度和${weeklyHours ? `每周 ${weeklyHours} 小时容量` : "默认学习容量"}${profileBasis}生成。`;
    const fullRationale = adjustmentRequest
      ? `${rationale} 本次还应用了你的调整要求：「${adjustmentRequest}」。`
      : rationale;
    const successCriteria = [
      `完成本周计划中的核心任务，计划总量约 ${Math.round(plannedMinutes / 60)} 小时`,
      "至少完成一次本周复盘，记录未完成原因与下周调整项",
      activeStage ? `能够说明本周任务如何支持阶段目标：${activeStage.objective}` : `明确下一周在${phase}中的具体推进重点`,
    ];
    const linkedMilestones = Array.from(new Set(planTasks.map((task) => task.milestoneTitle).filter(Boolean)));
    if (linkedMilestones.length > 0) {
      successCriteria.push(`推进本阶段里程碑：${linkedMilestones.slice(0, 3).join("、")}${linkedMilestones.length > 3 ? "等" : ""}`);
    }

    // 生成只落草稿；用户确认后，/api/weekly-plans 才会创建正式 Task。
    const draft = await prisma.$transaction(async (tx) => {
      await tx.weeklyPlan.updateMany({
        where: { userId: user!.id, weekStart: new Date(weekStartStr), status: "draft" },
        data: { status: "archived" },
      });
      const latest = await tx.weeklyPlan.findFirst({
        where: { userId: user!.id, weekStart: new Date(weekStartStr) },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const active = await tx.weeklyPlan.findFirst({
        where: { userId: user!.id, weekStart: new Date(weekStartStr), status: "active" },
        select: { id: true },
      });
      return tx.weeklyPlan.create({
        data: {
          userId: user!.id,
          studyPathId: activeStage?.studyPath.id ?? null,
          stageId: activeStage?.id ?? null,
          weekStart: new Date(weekStartStr),
          weekEnd: new Date(weekLastStr),
          version: (latest?.version ?? 0) + 1,
          objective,
          rationale: fullRationale,
          successCriteria,
          plannedMinutes,
          items: planTasks as unknown as Prisma.InputJsonValue,
          adjustmentRequest: adjustmentRequest || null,
          constraints: adjustmentRequest
            ? adjustmentConstraints as unknown as Prisma.InputJsonValue
            : undefined,
          generatedBy: aiConfig && generationMode !== "local" ? "ai" : "local",
          supersedesId: active?.id ?? null,
        },
      });
    });
    const phaseStats: Record<string, number> = {};
    for (const t of planTasks) { phaseStats[t.phase] = (phaseStats[t.phase] || 0) + 1; }

    return jsonNoStore({
      draft,
      tasks: planTasks,
      totalTasks: planTasks.length,
      planned: planTasks.length,
      daysRemaining,
      weekRange: { start: weekStartStr, end: weekEnd.toISOString().split("T")[0] },
      phases: phaseStats,
      generatedBy: aiConfig && generationMode !== "local" ? "ai" : "local",
      reasoning: truncateReasoning(planReasoning),
      stage: { id: stage.id, label: stage.label, hint: stage.hint, planSpanHint: stage.planSpanHint },
      planningReadiness,
    });
  } catch (err) {
    console.error("Generate plan error:", err);
    return jsonNoStore({ error: "生成计划失败，请稍后再试" }, { status: 500 });
  }
}
