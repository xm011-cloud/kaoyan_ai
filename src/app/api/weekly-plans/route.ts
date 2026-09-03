import { NextRequest } from "next/server";
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
    if (!id || !["activate", "archive"].includes(action)) {
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
