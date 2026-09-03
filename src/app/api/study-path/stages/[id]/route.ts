import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// PATCH: 用户确认完成当前阶段，并激活下一阶段。
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const confirmIncomplete = body.confirmIncomplete === true;

    const stage = await prisma.studyPathStage.findFirst({
      where: { id, studyPath: { userId: user!.id } },
      include: {
        studyPath: true,
        milestones: { select: { id: true, completedAt: true, progress: true } },
      },
    });
    if (!stage) return jsonNoStore({ error: "阶段不存在" }, { status: 404 });

    if (body.action === "updateDraft") {
      if (stage.studyPath.status !== "draft") {
        return jsonNoStore({ error: "只能共同编辑尚未确认的路线草稿" }, { status: 409 });
      }
      const objective = typeof body.objective === "string" ? body.objective.trim() : "";
      const rawExitCriteria: unknown[] = Array.isArray(body.exitCriteria) ? body.exitCriteria : [];
      const exitCriteria = rawExitCriteria
          .filter((item): item is string => typeof item === "string" && item.trim().length >= 3 && item.trim().length <= 120)
          .map((item) => item.trim()).slice(0, 8)
      if (objective.length < 5 || objective.length > 400) {
        return jsonNoStore({ error: "阶段目标请控制在 5 到 400 个字之间" }, { status: 400 });
      }
      if (exitCriteria.length === 0) {
        return jsonNoStore({ error: "请至少保留一条阶段退出标准" }, { status: 400 });
      }
      const updated = await prisma.studyPathStage.update({
        where: { id: stage.id },
        data: { objective, exitCriteria },
      });
      return jsonNoStore({ stage: updated });
    }

    if (stage.studyPath.status !== "active") {
      return jsonNoStore({ error: "只能推进当前已激活路线" }, { status: 409 });
    }

    if (stage.status === "completed") {
      const nextStage = await prisma.studyPathStage.findFirst({
        where: { studyPathId: stage.studyPathId, status: "active" },
        orderBy: { order: "asc" },
      });
      return jsonNoStore({ stage, nextStage, alreadyCompleted: true, pathCompleted: !nextStage });
    }
    if (stage.status !== "active") {
      return jsonNoStore({ error: "只能完成当前阶段" }, { status: 409 });
    }

    const completedMilestones = stage.milestones.filter(
      (milestone) => milestone.completedAt || milestone.progress >= 1
    ).length;
    const totalMilestones = stage.milestones.length;
    if (completedMilestones < totalMilestones && !confirmIncomplete) {
      return jsonNoStore(
        {
          error: `本阶段还有 ${totalMilestones - completedMilestones} 个里程碑未完成`,
          requiresConfirmation: true,
          completedMilestones,
          totalMilestones,
        },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const completedStage = await tx.studyPathStage.update({
        where: { id: stage.id },
        data: { status: "completed" },
      });
      const nextStage = await tx.studyPathStage.findFirst({
        where: { studyPathId: stage.studyPathId, order: { gt: stage.order }, status: "pending" },
        orderBy: { order: "asc" },
      });

      if (nextStage) {
        const activated = await tx.studyPathStage.update({
          where: { id: nextStage.id },
          data: { status: "active", startDate: nextStage.startDate || new Date() },
        });
        return { stage: completedStage, nextStage: activated, pathCompleted: false };
      }

      await tx.studyPath.update({
        where: { id: stage.studyPathId },
        data: { status: "completed" },
      });
      return { stage: completedStage, nextStage: null, pathCompleted: true };
    });

    return jsonNoStore(result);
  } catch (err) {
    console.error("Advance study-path stage error:", err);
    return jsonNoStore({ error: "推进学习阶段失败" }, { status: 500 });
  }
}
