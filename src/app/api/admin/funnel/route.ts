import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildFunnel, type FunnelActivity } from "@/lib/funnel";

/**
 * 用户激活漏斗（管理后台诊断页，仅 ADMIN_EMAIL 可见）。
 * 返回各阶段转化率 + 单用户轨迹（哪个阶段卡住 → 点开看使用痕迹）。
 * 见 docs/architecture-decisions.md 3.4。
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const [
      users,
      goalRows,
      planRows,
      taskRows,
      checkinRows,
      practiceRows,
      wqRows,
      spRows,
      skillRows,
      chatRows,
      materialRows,
      feedbackRows,
    ] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, aiKey: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.goal.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.task.groupBy({
        by: ["userId"],
        where: { source: { in: ["ai", "ai_confirmed"] } },
        _min: { createdAt: true },
      }),
      prisma.task.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.checkIn.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.practiceSession.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.wrongQuestion.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.studyPath.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.chat.groupBy({
        by: ["userId"],
        where: { skillId: { not: null } },
        _min: { createdAt: true },
      }),
      prisma.chat.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.material.groupBy({ by: ["userId"], _min: { createdAt: true } }),
      prisma.feedback.groupBy({ by: ["userId"], _min: { createdAt: true } }),
    ]);

    // 从 groupBy 结果里取某用户的某个最早时间
    const pickMin = (
      rows: { userId: string; _min: { createdAt: Date | null } }[],
      id: string
    ): Date | null => rows.find((r) => r.userId === id)?._min.createdAt ?? null;

    const report = buildFunnel(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        activity: {
          createdAt: u.createdAt,
          goalAt: pickMin(goalRows, u.id),
          planAt: pickMin(planRows, u.id),
          firstTaskAt: pickMin(taskRows, u.id),
          firstCheckinAt: pickMin(checkinRows, u.id),
          hasAiKey: !!u.aiKey,
          practiceAt: pickMin(practiceRows, u.id),
          wrongQuestionAt: pickMin(wqRows, u.id),
          studyPathAt: pickMin(spRows, u.id),
          skillRunAt: pickMin(skillRows, u.id),
          chatAt: pickMin(chatRows, u.id),
          materialAt: pickMin(materialRows, u.id),
          feedbackAt: pickMin(feedbackRows, u.id),
        } satisfies FunnelActivity,
      }))
    );

    return jsonNoStore(report);
  } catch (err) {
    return handleApiError(err, "查询激活漏斗");
  }
}
