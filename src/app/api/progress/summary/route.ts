import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
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
      return jsonNoStore({ bySubject: {}, daysLeft: 0, examDate: null });
    }

    const subjects = goal.subjects;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = goal.examDate ? new Date(goal.examDate) : null;
    const daysLeft = examDate ? Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / 86400000)) : null;

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

    return jsonNoStore({ bySubject, daysLeft, examDate: goal.examDate?.toISOString() ?? null });
  } catch (err) {
    console.error("Progress summary error:", err);
    return jsonNoStore({ error: "获取进度数据失败" }, { status: 500 });
  }
}
