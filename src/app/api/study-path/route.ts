import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJsonArray } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

// GET: 获取用户学习路径
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const path = await prisma.studyPath.findUnique({
      where: { userId: user!.id },
      include: {
        milestones: { orderBy: { order: "asc" } },
      },
    });

    if (!path) {
      return jsonNoStore({ path: null, milestones: [] });
    }

    // Compute stats
    const totalMilestones = path.milestones.length;
    const completedMilestones = path.milestones.filter((m) => m.completedAt).length;
    const overallProgress =
      totalMilestones > 0
        ? path.milestones.reduce((s, m) => s + m.progress, 0) / totalMilestones
        : 0;

    return jsonNoStore({
      path,
      milestones: path.milestones,
      stats: {
        totalMilestones,
        completedMilestones,
        overallProgress: Math.round(overallProgress * 100) / 100,
      },
    });
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
    const goal = await prisma.goal.findUnique({ where: { userId: user!.id } });
    if (!goal) {
      return jsonNoStore({ error: "请先设置考研目标" }, { status: 400 });
    }

    const examDate = new Date(goal.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));
    const targetScores = (goal.targetScores as Record<string, number>) || {};

    // Load wrong-question stats per subject for gap analysis
    const wqStats = await Promise.all(
      goal.subjects.map(async (subj) => {
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
    const aiConfig = await getUserAiConfig(user!.id);
    let milestones: Array<{
      title: string;
      description: string;
      phase: string;
      subject: string;
      order: number;
      targetDate?: string;
      tips?: string;
    }>;

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
- 目标院校：${goal.university} · ${goal.major}
- 考试日期：${examDate.toISOString().split("T")[0]}（剩余${daysRemaining}天）
- 科目：${goal.subjects.join("、")}

## 薄弱点分析
${gapLines}

## 要求
1. 划分 4 个阶段：基础巩固 → 强化提升 → 冲刺突破 → 查漏补缺
2. 每阶段 3-5 个里程碑，每个里程碑包含：标题、描述、所属科目、阶段、顺序、目标完成日期(YYYY-MM-DD)、学习建议
3. 根据错题多的科目多安排里程碑
4. 里程碑要具体可执行

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
        } else {
          throw new Error("AI returned invalid format");
        }
      } catch {
        // Fallback: generate locally
        milestones = generateLocalMilestones(goal.subjects, daysRemaining, wqStats);
      }
    } else {
      milestones = generateLocalMilestones(goal.subjects, daysRemaining, wqStats);
    }

    // Delete old path and milestones (cascade)
    const oldPath = await prisma.studyPath.findUnique({ where: { userId: user!.id } });
    if (oldPath) {
      await prisma.studyPath.delete({ where: { userId: user!.id } });
    }

    // Create new path
    const path = await prisma.studyPath.create({
      data: {
        userId: user!.id,
        title: `${new Date().getFullYear()} 考研 ${goal.university} 学习路径`,
        description: `目标：${goal.university} ${goal.major}，剩余${daysRemaining}天`,
        subjects: goal.subjects,
        targetScores: goal.targetScores as object | undefined,
        generatedBy: aiConfig ? "ai" : "manual",
        milestones: {
          create: milestones.map((m, i) => ({
            title: m.title,
            description: m.description,
            phase: m.phase,
            subject: m.subject,
            order: m.order || i,
            targetDate: m.targetDate ? new Date(m.targetDate) : null,
            tips: m.tips || null,
          })),
        },
      },
      include: { milestones: { orderBy: { order: "asc" } } },
    });

    return jsonNoStore({
      path,
      milestones: path.milestones,
      stats: {
        totalMilestones: path.milestones.length,
        completedMilestones: 0,
        overallProgress: 0,
      },
    });
  } catch (err) {
    console.error("Generate study-path error:", err);
    return jsonNoStore({ error: "生成学习路径失败" }, { status: 500 });
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
