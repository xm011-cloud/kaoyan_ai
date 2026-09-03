import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { parseStageAdjustment } from "@/lib/study-path-adjustment";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const adjustmentRequest = typeof body.request === "string" ? body.request.trim().slice(0, 1000) : "";
    if (!adjustmentRequest) return jsonNoStore({ error: "请描述需要调整的阶段内容" }, { status: 400 });

    const active = await prisma.studyPath.findFirst({
      where: { userId: user!.id, status: "active" },
      orderBy: { version: "desc" },
      include: {
        stages: { orderBy: { order: "asc" } },
        milestones: { orderBy: { order: "asc" } },
      },
    });
    if (!active) return jsonNoStore({ error: "请先确认一条长期学习路线" }, { status: 409 });

    const parsed = parseStageAdjustment(adjustmentRequest, active.subjects);
    if (parsed.scope === "weekly") {
      return jsonNoStore(
        { error: "这个要求更像本周临时调整，请在周计划中处理", scope: "weekly", suggestedHref: "/tasks" },
        { status: 409 },
      );
    }
    if (parsed.scope === "unclear") {
      return jsonNoStore(
        { error: "请说明哪个科目或知识模块需要补学，例如“计算机网络没学，需要补基础”", scope: "unclear" },
        { status: 422 },
      );
    }

    const activeStage = active.stages.find((stage) => stage.status === "active");
    if (!activeStage) return jsonNoStore({ error: "当前路线没有可调整的活动阶段" }, { status: 409 });
    const additions = parsed.additions.filter(
      (addition) => !active.milestones.some(
        (milestone) => milestone.stageId === activeStage.id
          && milestone.subject === addition.subject
          && milestone.title === addition.title,
      ),
    );
    if (additions.length === 0) {
      return jsonNoStore(
        { error: "当前阶段已经包含这些补基础里程碑，无需重复添加", scope: "no_change" },
        { status: 409 },
      );
    }
    const downstreamStageCount = active.stages.filter((stage) => stage.order > activeStage.order).length;
    const preservedCompletedMilestones = active.milestones.filter((milestone) => milestone.completedAt).length;
    const weeklyPlanNeedsReview = await prisma.weeklyPlan.count({
      where: { userId: user!.id, status: "active", stageId: activeStage.id },
    });
    const impact = {
      scope: "stage",
      changedStage: { key: activeStage.key, title: activeStage.title },
      addedMilestones: additions.map((addition) => ({ title: addition.title, subject: addition.subject })),
      preservedCompletedMilestones,
      downstreamStageCount,
      weeklyPlanNeedsReview: weeklyPlanNeedsReview > 0,
      datesChanged: false,
      scheduleRisk: "review_needed",
      requiresConfirmation: true,
    };

    const created = await prisma.$transaction(async (tx) => {
      await tx.studyPath.updateMany({
        where: { userId: user!.id, status: "draft" },
        data: { status: "superseded" },
      });
      const latest = await tx.studyPath.findFirst({
        where: { userId: user!.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const path = await tx.studyPath.create({
        data: {
          userId: user!.id,
          goalId: active.goalId,
          title: active.title,
          description: active.description,
          subjects: active.subjects,
          targetScores: active.targetScores as Prisma.InputJsonValue | undefined,
          currentScores: active.currentScores as Prisma.InputJsonValue | undefined,
          version: (latest?.version ?? 0) + 1,
          status: "draft",
          supersedesId: active.id,
          generatedBy: "manual",
          adjustmentRequest,
          changeImpact: impact,
        },
      });

      const stageIds = new Map<string, string>();
      for (const stage of active.stages) {
        const isAdjusted = stage.id === activeStage.id;
        const exitCriteria = Array.isArray(stage.exitCriteria)
          ? (stage.exitCriteria as string[])
          : [];
        const cloned = await tx.studyPathStage.create({
          data: {
            studyPathId: path.id,
            key: stage.key,
            title: stage.title,
            order: stage.order,
            objective: isAdjusted
              ? `${stage.objective}；补充完成：${additions.map((addition) => addition.topic).join("、")}`
              : stage.objective,
            exitCriteria: isAdjusted
              ? [...exitCriteria, ...additions.map((addition) => addition.exitCriterion)]
              : exitCriteria,
            status: stage.status,
            startDate: stage.startDate,
            endDate: stage.endDate,
          },
        });
        stageIds.set(stage.id, cloned.id);
      }

      await tx.studyPathMilestone.createMany({
        data: active.milestones.map((milestone) => ({
          studyPathId: path.id,
          stageId: milestone.stageId ? stageIds.get(milestone.stageId) ?? null : null,
          title: milestone.title,
          description: milestone.description,
          phase: milestone.phase,
          subject: milestone.subject,
          order: milestone.order,
          targetDate: milestone.targetDate,
          completedAt: milestone.completedAt,
          progress: milestone.progress,
          tips: milestone.tips,
        })),
      });
      const maxOrder = active.milestones.reduce((max, milestone) => Math.max(max, milestone.order), 0);
      await tx.studyPathMilestone.createMany({
        data: additions.map((addition, index) => ({
          studyPathId: path.id,
          stageId: stageIds.get(activeStage.id) ?? null,
          title: addition.title,
          description: addition.description,
          phase: activeStage.title,
          subject: addition.subject,
          order: maxOrder + index + 1,
          targetDate: activeStage.endDate,
          tips: "先完成基础学习，再通过练习或对话校准掌握程度。",
        })),
      });

      return tx.studyPath.findUniqueOrThrow({
        where: { id: path.id },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      });
    });

    const overallProgress = created.milestones.length > 0
      ? created.milestones.reduce((sum, milestone) => sum + milestone.progress, 0) / created.milestones.length
      : 0;
    return jsonNoStore({
      path: created,
      stages: created.stages,
      milestones: created.milestones,
      stats: {
        totalMilestones: created.milestones.length,
        completedMilestones: created.milestones.filter((milestone) => milestone.completedAt).length,
        overallProgress,
      },
      isDraft: true,
      activePathId: active.id,
    });
  } catch (err) {
    return handleApiError(err, "生成阶段调整提案");
  }
}
