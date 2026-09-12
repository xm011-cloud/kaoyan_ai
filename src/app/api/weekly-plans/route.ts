import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { compareWeeklyPlans } from "@/lib/weekly-plan-impact";

interface WeeklyPlanItem {
  title: string;
  description?: string | null;
  date: string;
  duration?: number | null;
  phase?: string | null;
  subject?: string | null;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const weekStart = new URL(request.url).searchParams.get("weekStart");
    if (!weekStart) return jsonNoStore({ error: "缺少周开始日期" }, { status: 400 });

    const plans = await prisma.weeklyPlan.findMany({
      where: { userId: user!.id, weekStart: new Date(weekStart) },
      orderBy: { version: "desc" },
      include: { stage: { select: { title: true, objective: true, exitCriteria: true, status: true } } },
    });
    const draft = plans.find((plan) => plan.status === "draft") ?? null;
    const active = plans.find((plan) => plan.status === "active") ?? null;
    const activeTasks = active
      ? await prisma.task.findMany({
          where: { weeklyPlanId: active.id, completed: false },
          select: { title: true, subject: true, date: true, duration: true },
        })
      : [];
    const draftItems = draft && Array.isArray(draft.items)
      ? (draft.items as unknown as WeeklyPlanItem[])
      : [];
    const impact = draft ? compareWeeklyPlans(activeTasks, draftItems) : null;
    return jsonNoStore({
      draft: draft ? { ...draft, impact } : null,
      active,
      versions: plans,
    });
  } catch (err) {
    return handleApiError(err, "获取周计划");
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!id || !["activate", "archive", "restore"].includes(action)) {
      return jsonNoStore({ error: "无效的周计划操作" }, { status: 400 });
    }

    const plan = await prisma.weeklyPlan.findFirst({ where: { id, userId: user!.id } });
    if (!plan) return jsonNoStore({ error: "周计划不存在" }, { status: 404 });

    if (action === "archive") {
      if (plan.status === "active") {
        return jsonNoStore({ error: "已生效计划不能直接废弃" }, { status: 409 });
      }
      if (plan.status === "archived") return jsonNoStore({ plan, alreadyArchived: true });
      const archived = await prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { status: "archived" },
      });
      return jsonNoStore({ plan: archived });
    }

    // 历史版本不能直接覆盖当前任务：恢复只复制为一份新草稿，仍复用后续的影响比对与确认流程。
    if (action === "restore") {
      if (plan.status !== "archived") {
        return jsonNoStore({ error: "只有历史版本可以恢复为草稿" }, { status: 409 });
      }
      const latest = await prisma.weeklyPlan.findFirst({
        where: { userId: user!.id, weekStart: plan.weekStart },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const active = await prisma.weeklyPlan.findFirst({
        where: { userId: user!.id, weekStart: plan.weekStart, status: "active" },
        select: { id: true },
      });
      const currentPath = await prisma.studyPath.findFirst({
        where: { userId: user!.id, status: "active" },
        orderBy: { version: "desc" },
        include: { milestones: { select: { id: true, title: true, subject: true } } },
      });
      const currentMilestoneIds = new Set(currentPath?.milestones.map((milestone) => milestone.id) ?? []);
      const currentByTitle = new Map(
        (currentPath?.milestones ?? []).map((milestone) => [`${milestone.subject}|${milestone.title}`, milestone]),
      );
      const sourceItems = Array.isArray(plan.items) ? (plan.items as unknown as WeeklyPlanItem[]) : [];
      let remappedMilestones = 0;
      let unlinkedMilestones = 0;
      const items = sourceItems.map((item) => {
        if (!item.milestoneId || currentMilestoneIds.has(item.milestoneId)) return item;
        const replacement = currentByTitle.get(`${item.subject ?? ""}|${item.milestoneTitle ?? ""}`);
        if (replacement) {
          remappedMilestones++;
          return { ...item, milestoneId: replacement.id, milestoneTitle: replacement.title };
        }
        unlinkedMilestones++;
        return {
          ...item,
          milestoneId: null,
          milestoneTitle: item.milestoneTitle ? `原路线：${item.milestoneTitle}（需重新归属）` : "需重新归属路线",
        };
      });
      const draft = await prisma.weeklyPlan.create({
        data: {
          userId: user!.id,
          studyPathId: currentPath?.id ?? null,
          stageId: null,
          weekStart: plan.weekStart,
          weekEnd: plan.weekEnd,
          version: (latest?.version ?? 0) + 1,
          status: "draft",
          objective: plan.objective,
          rationale: plan.rationale,
          successCriteria: plan.successCriteria as Prisma.InputJsonValue,
          plannedMinutes: plan.plannedMinutes,
          items: items as unknown as Prisma.InputJsonValue,
          constraints: plan.constraints === null ? undefined : plan.constraints as Prisma.InputJsonValue,
          generatedBy: "manual",
          adjustmentRequest: `恢复自历史周计划 V${plan.version}${unlinkedMilestones ? `；${unlinkedMilestones} 项需重新归属当前路线` : ""}`,
          supersedesId: active?.id ?? plan.id,
        },
      });
      return jsonNoStore({
        plan: draft,
        restoredFromVersion: plan.version,
        restoreImpact: { remappedMilestones, unlinkedMilestones },
      });
    }

    if (plan.status === "active") return jsonNoStore({ plan, alreadyActive: true });
    if (plan.status !== "draft") {
      return jsonNoStore({ error: "只有草稿可以确认生效" }, { status: 409 });
    }

    const items = Array.isArray(plan.items) ? (plan.items as unknown as WeeklyPlanItem[]) : [];
    const previousActive = await prisma.weeklyPlan.findFirst({
      where: { userId: user!.id, weekStart: plan.weekStart, status: "active" },
      include: {
        tasks: {
          where: { completed: false },
          select: { title: true, subject: true, date: true, duration: true },
        },
      },
    });
    const impact = compareWeeklyPlans(previousActive?.tasks ?? [], items);
    if (impact.requiresConfirmation && body.confirmImpact !== true) {
      return jsonNoStore(
        { error: "新计划会调整当前未完成任务，请确认影响后再应用", requiresConfirmation: true, impact },
        { status: 409 },
      );
    }
    const activated = await prisma.$transaction(async (tx) => {
      const previous = await tx.weeklyPlan.findFirst({
        where: { userId: user!.id, weekStart: plan.weekStart, status: "active" },
      });
      if (previous) {
        await tx.task.deleteMany({ where: { weeklyPlanId: previous.id, completed: false } });
        await tx.weeklyPlan.update({ where: { id: previous.id }, data: { status: "archived" } });
      }

      const active = await tx.weeklyPlan.update({
        where: { id: plan.id },
        data: { status: "active", confirmedAt: new Date(), supersedesId: previous?.id ?? plan.supersedesId },
      });
      const completedTasks = await tx.task.findMany({
        where: {
          userId: user!.id,
          completed: true,
          date: { gte: plan.weekStart, lte: plan.weekEnd },
        },
        select: { title: true, date: true },
      });
      const completedKeys = new Set(
        completedTasks.map((task) => `${task.title}|${task.date.toISOString().slice(0, 10)}`),
      );
      const pendingItems = items.filter(
        (item) => !completedKeys.has(`${item.title}|${String(item.date).slice(0, 10)}`),
      );
      const milestoneIds = Array.from(new Set(
        pendingItems.map((item) => item.milestoneId).filter((id): id is string => typeof id === "string" && id.length > 0),
      ));
      const validMilestoneIds = new Set((await tx.studyPathMilestone.findMany({
        where: { id: { in: milestoneIds }, studyPath: { userId: user!.id } },
        select: { id: true },
      })).map((item) => item.id));
      if (pendingItems.length > 0) {
        await tx.task.createMany({
          data: pendingItems.map((item) => ({
            userId: user!.id,
            weeklyPlanId: active.id,
            title: item.title,
            description: item.description ?? null,
            date: new Date(item.date),
            duration: item.duration ?? null,
            phase: item.phase ?? null,
            subject: item.subject ?? null,
            weekStartDate: plan.weekStart,
            source: "ai_confirmed",
            milestoneId: item.milestoneId && validMilestoneIds.has(item.milestoneId) ? item.milestoneId : null,
          })),
        });
      }
      return active;
    });

    return jsonNoStore({ plan: activated, taskCount: items.length, impact });
  } catch (err) {
    return handleApiError(err, "更新周计划");
  }
}
