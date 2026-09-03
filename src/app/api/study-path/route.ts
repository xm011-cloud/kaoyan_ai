import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJsonArray, truncateReasoning } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { getGoalLabel, hasConfirmedGoalShape } from "@/lib/goal-model";
import type { Prisma } from "@prisma/client";
import { buildStageDefinitions } from "@/lib/study-path-stage";

type PathWithMilestones = Prisma.StudyPathGetPayload<{
  include: { milestones: true; stages: true };
}>;

function pathResponse(path: PathWithMilestones | null, activePathId: string | null) {
  if (!path) return { path: null, stages: [], milestones: [], stats: null, isDraft: false, activePathId };

  const totalMilestones = path.milestones.length;
  const completedMilestones = path.milestones.filter((m) => m.completedAt).length;
  const overallProgress = totalMilestones > 0
    ? path.milestones.reduce((sum, milestone) => sum + milestone.progress, 0) / totalMilestones
    : 0;

  return {
    path,
    stages: path.stages,
    milestones: path.milestones,
    stats: {
      totalMilestones,
      completedMilestones,
      overallProgress: Math.round(overallProgress * 100) / 100,
    },
    isDraft: path.status === "draft",
    activePathId,
  };
}

// GET: 获取用户学习路径
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const [draft, active, history] = await Promise.all([
      prisma.studyPath.findFirst({
        where: { userId: user!.id, status: "draft" },
        orderBy: { version: "desc" },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      }),
      prisma.studyPath.findFirst({
        where: { userId: user!.id, status: "active" },
        orderBy: { version: "desc" },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      }),
      prisma.studyPath.findMany({
        where: { userId: user!.id },
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          title: true,
          adjustmentRequest: true,
          changeImpact: true,
          confirmedAt: true,
          createdAt: true,
          _count: { select: { stages: true, milestones: true } },
        },
      }),
    ]);

    return jsonNoStore({ ...pathResponse(draft || active, active?.id ?? null), history });
  } catch (err) {
    console.error("Get study-path error:", err);
    return jsonNoStore({ error: "获取学习路径失败" }, { status: 500 });
  }
}

// POST: 生成新的学习路径
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const requestBody = await request.json().catch(() => ({}));
    const useLocalTemplate = requestBody.generationMode === "local";
    const [goal, profileFacts] = await Promise.all([
      prisma.goal.findUnique({ where: { userId: user!.id } }),
      prisma.studyProfileFact.findMany({
        where: { userId: user!.id, status: "confirmed" },
        orderBy: { observedAt: "desc" },
      }),
    ]);
    if (!goal) {
      return jsonNoStore({ error: "请先保存一个学习方向，再设计长期路线" }, { status: 400 });
    }

    const confirmedGoal = hasConfirmedGoalShape(goal) && Boolean(goal.examDate);
    const examDate = goal.examDate ? new Date(goal.examDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = examDate
      ? Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000))
      : null;
    const profileSubjects = profileFacts
      .map((fact) => {
        if (!fact.value || typeof fact.value !== "object" || Array.isArray(fact.value)) return null;
        const subject = (fact.value as { subject?: unknown }).subject;
        return typeof subject === "string" && subject.trim() ? subject.trim() : null;
      })
      .filter((subject): subject is string => Boolean(subject));
    const planningSubjects = Array.from(new Set([
      ...goal.subjects,
      ...(!confirmedGoal ? profileSubjects : []),
    ]));
    if (planningSubjects.length === 0) planningSubjects.push("公共基础");
    const targetScores = (goal.targetScores as Record<string, number>) || {};

    // Load wrong-question stats per subject for gap analysis
    const wqStats = await Promise.all(
      planningSubjects.map(async (subj) => {
        const total = await prisma.wrongQuestion.count({
          where: { userId: user!.id, subject: subj },
        });
        const unreviewed = await prisma.wrongQuestion.count({
          where: { userId: user!.id, subject: subj, reviewed: false },
        });
        return { subject: subj, totalWq: total, unreviewedWq: unreviewed };
      })
    );

    // Build milestones
    // 探索期可能使用私人学习档案补足上下文，默认只走本地模板，不把档案原文或派生事实发送给外部模型。
    const aiConfig = useLocalTemplate || !confirmedGoal ? null : await getUserAiConfig(user!.id);
    let milestones: Array<{
      title: string;
      description: string;
      phase: string;
      subject: string;
      order: number;
      targetDate?: string;
      tips?: string;
    }>;

    let pathReasoning: string | undefined;

    if (aiConfig) {
      const gapLines = wqStats
        .map((s) => {
          const score = targetScores[s.subject];
          return score
            ? `- ${s.subject}: 目标${score}分，错题${s.totalWq}道（待复习${s.unreviewedWq}道）`
            : `- ${s.subject}: 错题${s.totalWq}道（待复习${s.unreviewedWq}道）`;
        })
        .join("\n");

      const prompt = `你是考研辅导专家。请根据以下信息生成分阶段学习路径。

## 用户情况
- 当前方向：${getGoalLabel(goal)}
- 目标状态：${confirmedGoal ? "已确认" : "仍在探索，未知信息不得猜测"}
- 目标院校：${goal.university || "尚未确定"}
- 目标专业：${goal.major || "尚未确定"}
- 考试时间：${examDate ? `${examDate.toISOString().split("T")[0]}（剩余${daysRemaining}天）` : goal.examYear ? `${goal.examYear} 年，具体日期待确认` : "尚未确定"}
- 已知或当前学习科目：${planningSubjects.join("、")}

## 薄弱点分析
${gapLines}

## 要求
1. ${confirmedGoal ? "划分 4 个阶段：基础巩固 → 强化提升 → 冲刺突破 → 查漏补缺" : "目标仍不完整：只生成“目标探索与基础启动 → 基础巩固”两个可逆阶段，不生成依赖具体院校、考试范围或日期的冲刺承诺"}
2. 每阶段 3-5 个里程碑，每个里程碑包含：标题、描述、所属科目、阶段、顺序、目标完成日期(YYYY-MM-DD)、学习建议
3. 根据错题多的科目多安排里程碑
4. 里程碑要具体可执行
5. 用户陈述、自评和系统记录是不同证据；不得把自评写成已测评结论

输出严格JSON：
[{
  "title": "极限与连续基础",
  "description": "系统复习极限定义、性质和计算方法，完成配套练习题",
  "phase": "基础巩固",
  "subject": "数学一",
  "order": 1,
  "targetDate": "2026-07-25",
  "tips": "重点: 等价无穷小替换、洛必达法则的使用条件"
}]`;

      try {
        const result = await callAI(aiConfig, {
          messages: [
            { role: "system", content: "你是考研辅导专家。只返回JSON数组，不返回其他内容。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          maxTokens: 16384,
        });

        const fullContent = result.text || result.reasoningText || "";
        const parsed = extractJsonArray<{ title: string; description: string; phase: string; subject: string; order: number; targetDate?: string; tips?: string }>(fullContent);
        if (parsed && parsed.length > 0) {
          milestones = parsed;
          pathReasoning = result.reasoningText || undefined;
        } else {
          throw new Error("AI returned invalid format");
        }
      } catch {
        // Fallback: generate locally
        milestones = confirmedGoal
          ? generateLocalMilestones(planningSubjects, daysRemaining!, wqStats)
          : generateExplorationMilestones(planningSubjects, profileFacts);
      }
    } else {
      milestones = confirmedGoal
        ? generateLocalMilestones(planningSubjects, daysRemaining!, wqStats)
        : generateExplorationMilestones(planningSubjects, profileFacts);
    }

    const { path, activePathId } = await prisma.$transaction(async (tx) => {
      const [active, latest] = await Promise.all([
        tx.studyPath.findFirst({ where: { userId: user!.id, status: "active" }, orderBy: { version: "desc" } }),
        tx.studyPath.findFirst({ where: { userId: user!.id }, orderBy: { version: "desc" }, select: { version: true } }),
      ]);

      await tx.studyPath.updateMany({
        where: { userId: user!.id, status: "draft" },
        data: { status: "superseded" },
      });

      const createdPath = await tx.studyPath.create({
        data: {
          userId: user!.id,
          goalId: goal.id,
          version: (latest?.version ?? 0) + 1,
          status: "draft",
          supersedesId: active?.id ?? null,
          title: `${goal.examYear || examDate?.getFullYear() || "探索中"} ${getGoalLabel(goal)} 学习路径`,
          description: confirmedGoal
            ? `目标：${getGoalLabel(goal)}，剩余${daysRemaining}天`
            : `方向：${getGoalLabel(goal)}。当前信息尚不完整，本路线先确认范围并启动公共基础。`,
          subjects: planningSubjects,
          targetScores: goal.targetScores as object | undefined,
          generatedBy: aiConfig ? "ai" : "manual",
        },
      });

      const stageIdByTitle = new Map<string, string>();
      for (const stage of buildStageDefinitions(milestones)) {
        const createdStage = await tx.studyPathStage.create({
          data: {
            studyPathId: createdPath.id,
            key: stage.key,
            title: stage.title,
            order: stage.order,
            objective: stage.objective,
            exitCriteria: stage.exitCriteria,
            status: "pending",
            startDate: stage.startDate,
            endDate: stage.endDate,
          },
        });
        stageIdByTitle.set(stage.title, createdStage.id);
      }

      await tx.studyPathMilestone.createMany({
        data: milestones.map((milestone, index) => ({
          studyPathId: createdPath.id,
          stageId: stageIdByTitle.get(milestone.phase) ?? null,
          title: milestone.title,
          description: milestone.description,
          phase: milestone.phase,
          subject: milestone.subject,
          order: milestone.order || index,
          targetDate: milestone.targetDate ? new Date(milestone.targetDate) : null,
          tips: milestone.tips || null,
        })),
      });

      const created = await tx.studyPath.findUniqueOrThrow({
        where: { id: createdPath.id },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      });

      return { path: created, activePathId: active?.id ?? null };
    }, { maxWait: 5000, timeout: 15000 });

    return jsonNoStore({
      ...pathResponse(path, activePathId),
      reasoning: truncateReasoning(pathReasoning),
    });
  } catch (err) {
    console.error("Generate study-path error:", err);
    return jsonNoStore({ error: "生成学习路径失败" }, { status: 500 });
  }
}

// PATCH: 激活或放弃路线草稿。生成与激活分离，避免 AI 直接覆盖当前路线。
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const pathId = typeof body.pathId === "string" ? body.pathId : "";
    const action = body.action;
    if (!pathId || (action !== "activate" && action !== "discard")) {
      return jsonNoStore({ error: "缺少有效的路线草稿操作" }, { status: 400 });
    }

    const candidate = await prisma.studyPath.findFirst({
      where: { id: pathId, userId: user!.id },
      include: {
        stages: { orderBy: { order: "asc" } },
        milestones: { orderBy: { order: "asc" } },
      },
    });
    if (!candidate) return jsonNoStore({ error: "路线不存在" }, { status: 404 });

    if (action === "discard") {
      if (candidate.status === "draft") {
        await prisma.studyPath.update({ where: { id: candidate.id }, data: { status: "superseded" } });
      }
      const active = await prisma.studyPath.findFirst({
        where: { userId: user!.id, status: "active" },
        orderBy: { version: "desc" },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      });
      return jsonNoStore(pathResponse(active, active?.id ?? null));
    }

    if (candidate.status === "active") {
      return jsonNoStore(pathResponse(candidate, candidate.id));
    }
    if (candidate.status !== "draft") {
      return jsonNoStore({ error: "只有草稿路线可以激活" }, { status: 409 });
    }
    if (candidate.adjustmentRequest && body.confirmImpact !== true) {
      return jsonNoStore(
        {
          error: "阶段调整会改变当前路线，请确认影响后再启用",
          requiresConfirmation: true,
          impact: candidate.changeImpact,
        },
        { status: 409 },
      );
    }

    const activated = await prisma.$transaction(async (tx) => {
      await tx.studyPath.updateMany({
        where: { userId: user!.id, status: "active", id: { not: candidate.id } },
        data: { status: "superseded" },
      });
      // 全新路线从第一阶段开始；阶段调整草稿已经克隆原阶段状态，不得把用户退回第一阶段。
      if (!candidate.adjustmentRequest) {
        await tx.studyPathStage.updateMany({
          where: { studyPathId: candidate.id },
          data: { status: "pending" },
        });
        const firstStage = await tx.studyPathStage.findFirst({
          where: { studyPathId: candidate.id },
          orderBy: { order: "asc" },
        });
        if (firstStage) {
          await tx.studyPathStage.update({ where: { id: firstStage.id }, data: { status: "active" } });
        }
      }
      return tx.studyPath.update({
        where: { id: candidate.id },
        data: { status: "active", confirmedAt: new Date() },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      });
    });

    return jsonNoStore(pathResponse(activated, activated.id));
  } catch (err) {
    console.error("Update study-path status error:", err);
    return jsonNoStore({ error: "更新学习路径失败" }, { status: 500 });
  }
}

// Local fallback milestone generator
function generateLocalMilestones(
  subjects: string[],
  daysRemaining: number,
  wqStats: Array<{ subject: string; totalWq: number; unreviewedWq: number }>
) {
  const phases = [
    { name: "基础巩固", daysPct: 0.35 },
    { name: "强化提升", daysPct: 0.30 },
    { name: "冲刺突破", daysPct: 0.25 },
    { name: "查漏补缺", daysPct: 0.10 },
  ];

  const milestones: Array<{
    title: string; description: string; phase: string;
    subject: string; order: number; targetDate?: string; tips?: string;
  }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dayOffset = 0;
  let order = 0;

  for (const phase of phases) {
    const phaseDays = Math.ceil(daysRemaining * phase.daysPct);

    for (const subject of subjects) {
      const stat = wqStats.find((s) => s.subject === subject);
      const weakMultiplier = stat && stat.unreviewedWq > 5 ? 2 : 1;

      for (let m = 0; m < weakMultiplier; m++) {
        const target = new Date(today.getTime() + (dayOffset + Math.floor(phaseDays / (weakMultiplier + 1)) * (m + 1)) * 86400000);

        const suffixes = ["入门与框架", "核心知识点", "难点突破", "综合练习"];
        const suffix = suffixes[m % suffixes.length];

        milestones.push({
          title: `[${phase.name}] ${subject} ${suffix}`,
          description: `在${phase.name}阶段完成${subject}的${suffix}学习任务`,
          phase: phase.name,
          subject,
          order: order++,
          targetDate: target.toISOString().split("T")[0],
          tips: stat && stat.unreviewedWq > 0
            ? `此科目有 ${stat.unreviewedWq} 道待复习错题，建议优先复习`
            : undefined,
        });
      }
    }
    dayOffset += phaseDays;
  }

  return milestones;
}

function generateExplorationMilestones(
  subjects: string[],
  profileFacts: Array<{ label: string; value: unknown; source: string; confidence: string }>,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetAfter = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().split("T")[0];
  const milestones: Array<{
    title: string; description: string; phase: string;
    subject: string; order: number; targetDate?: string; tips?: string;
  }> = [
    {
      title: "确认考试时间与目标分支",
      description: "记录已确定的考试年份、院校与科目，并把仍未知的内容保留为待确认分支。",
      phase: "目标探索与基础启动",
      subject: "目标规划",
      order: 0,
      targetDate: targetAfter(7),
      tips: "不知道可以明确写“待确认”，不要用假定信息生成刚性任务。",
    },
    {
      title: "完成各科初始水平扫描",
      description: "按科目记录尚未学习、正在学习、基础完成和需要自检的模块。",
      phase: "目标探索与基础启动",
      subject: "学习诊断",
      order: 1,
      targetDate: targetAfter(14),
      tips: "自评与测评结果分开保存；不确定时先做小范围自检。",
    },
    {
      title: "校准可持续学习容量",
      description: "结合课程、实习和休息安排，确认每周能够稳定投入的时间以及固定不可用时段。",
      phase: "目标探索与基础启动",
      subject: "学习安排",
      order: 2,
      targetDate: targetAfter(14),
      tips: "先按可长期坚持的容量规划，不用短期极限时间。",
    },
  ];

  const foundationSubjects = subjects.filter((subject) => subject !== "公共基础");
  const effectiveSubjects = foundationSubjects.length > 0 ? foundationSubjects : ["公共基础"];
  for (const [index, subject] of effectiveSubjects.entries()) {
    const related = profileFacts.find((fact) => {
      if (fact.label.includes(subject) || subject.includes(fact.label.replace(/尚未开始|基础薄弱/g, ""))) return true;
      if (!fact.value || typeof fact.value !== "object" || Array.isArray(fact.value)) return false;
      return (fact.value as { subject?: unknown }).subject === subject;
    });
    milestones.push({
      title: related ? `${subject}：按当前缺口启动基础学习` : `${subject}：建立首轮基础框架`,
      description: related
        ? `根据已确认档案“${related.label}”，从先修知识和基础内容开始，不直接跳入强化题。`
        : `确认${subject}的学习范围，完成首轮知识框架和基础练习。`,
      phase: "基础巩固",
      subject,
      order: milestones.length,
      targetDate: targetAfter(42 + index * 14),
      tips: related
        ? `依据：${related.label}（${related.source} / ${related.confidence}）`
        : "达到“能独立完成基础题”后，再确认是否进入强化阶段。",
    });
  }

  while (milestones.filter((item) => item.phase === "基础巩固").length < 3) {
    const index = milestones.filter((item) => item.phase === "基础巩固").length;
    const extras = [
      {
        title: "形成第一版知识结构",
        description: "把已学习内容整理成章节或知识点结构，标记未学、薄弱和待验证部分。",
        subject: "公共基础",
      },
      {
        title: "完成基础题与错题记录闭环",
        description: "通过少量基础题验证理解，并开始记录错误原因和需要回看的知识点。",
        subject: "公共基础",
      },
      {
        title: "复核基础阶段退出标准",
        description: "逐项确认课程、基础题和知识结构是否达到约定标准，再决定是否进入强化。",
        subject: "阶段复盘",
      },
    ][index] || {
      title: "复核基础阶段退出标准",
      description: "逐项确认本阶段成果，再决定是否进入下一阶段。",
      subject: "阶段复盘",
    };
    milestones.push({
      ...extras,
      phase: "基础巩固",
      order: milestones.length,
      targetDate: targetAfter(70 + index * 14),
      tips: "退出标准由用户确认，不因日期到达自动升级。",
    });
  }

  return milestones;
}
