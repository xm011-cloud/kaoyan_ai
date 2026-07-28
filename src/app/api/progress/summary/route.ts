import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/progress/summary
 *
 * 返回各科学习进度汇总：知识图谱掌握度、错题统计、练习分数、任务完成率、里程碑进度。
 * 作为"辅助参考"数据源展示在进度编辑区旁边。
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const goal = await prisma.goal.findUnique({ where: { userId: user!.id } });
    if (!goal) {
      return NextResponse.json({ bySubject: {}, daysLeft: 0, examDate: null });
    }

    const subjects = goal.subjects;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(goal.examDate);
    const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

    const bySubject: Record<string, Record<string, unknown>> = {};

    for (const subject of subjects) {
      // 知识图谱节点平均掌握度
      const nodes = await prisma.knowledgeNode.findMany({
        where: { userId: user!.id, subject },
        select: { mastery: true },
      });
      const knowledgeMastery =
        nodes.length > 0
          ? Math.round((nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length) * 100) / 100
          : null;

      // 错题统计
      const [wrongTotal, wrongReviewed, wrongDue] = await Promise.all([
        prisma.wrongQuestion.count({ where: { userId: user!.id, subject } }),
        prisma.wrongQuestion.count({ where: { userId: user!.id, subject, reviewed: true } }),
        prisma.wrongQuestion.count({
          where: {
            userId: user!.id,
            subject,
            reviewed: false,
            nextReviewDate: { lte: today },
          },
        }),
      ]);

      // 练习分数
      const completedSessions = await prisma.practiceSession.findMany({
        where: { userId: user!.id, subject, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 10,
      });
      const practiceAvg =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((s, sess) => {
                const pct = sess.maxScore && sess.maxScore > 0 ? (sess.totalScore || 0) / sess.maxScore : 0;
                return s + pct;
              }, 0) / completedSessions.length * 100
            )
          : null;

      bySubject[subject] = {
        knowledgeMastery,
        wrongQuestions: { total: wrongTotal, reviewed: wrongReviewed, unreviewed: wrongTotal - wrongReviewed, dueToday: wrongDue },
        practiceScores: practiceAvg !== null ? { avg: practiceAvg, sessions: completedSessions.length } : null,
      };
    }

    // 阶段计算
    const phases = computePhases(examDate, today);

    return NextResponse.json({ bySubject, daysLeft, examDate: goal.examDate.toISOString(), phases });
  } catch (err) {
    console.error("Progress summary error:", err);
    return NextResponse.json({ error: "获取进度数据失败" }, { status: 500 });
  }
}

function computePhases(examDate: Date, today: Date) {
  const totalDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

  const phaseDefs = [
    { name: "基础阶段", ratio: 0.4, goal: "系统学习教材，完成课后习题，打牢基础" },
    { name: "强化阶段", ratio: 0.35, goal: "专题突破，真题训练，提升解题能力" },
    { name: "冲刺阶段", ratio: 0.25, goal: "模拟冲刺，查漏补缺，调整状态" },
  ];

  let start = new Date(today);
  const now = new Date();
  const result: { name: string; start: string; end: string; goal: string; isCurrent: boolean }[] = [];

  for (const p of phaseDefs) {
    const days = Math.ceil(totalDays * p.ratio);
    const end = new Date(start.getTime() + days * 86400000);
    result.push({
      name: p.name,
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      goal: p.goal,
      isCurrent: now >= start && now < end,
    });
    start = new Date(end.getTime() + 86400000);
  }

  return result;
}
