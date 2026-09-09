import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取任务列表（支持 ?date= / ?subject= / ?weekStart= 筛选）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const subject = searchParams.get("subject");
    const weekStart = searchParams.get("weekStart");

    const where: Record<string, unknown> = { userId: user!.id };
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }
    if (subject) where.subject = subject;
    if (weekStart) {
      // 任务归属周的事实来源是 date。weekStartDate 是计划关联/索引字段，
      // 不能让缺失该字段的旧任务或 AI 直建任务在周视图中消失。
      const ws = new Date(`${weekStart}T00:00:00`);
      const weekEnd = new Date(ws);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // 同时保留旧 weekStartDate 的周日/周一兼容窗口，避免历史数据丢失。
      const legacyStart = new Date(ws.getTime() - 86400000);
      const legacyEnd = new Date(ws.getTime() + 86400000);
      where.OR = [
        { date: { gte: ws, lt: weekEnd } },
        { weekStartDate: { gte: legacyStart, lt: legacyEnd } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { date: "asc" },
      include: { milestone: { select: { title: true } } },
    });

    return jsonNoStore({ tasks: tasks.map(({ milestone, ...task }) => ({ ...task, milestoneTitle: milestone?.title ?? null })) });
  } catch (err) {
    return handleApiError(err, "获取任务列表");
  }
}

// POST: 创建任务
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { title, description, date, duration, phase, subject, weekStartDate, source, courseLessonId } = body;

    if (!title || !date) {
      return jsonNoStore({ error: "标题和日期为必填项" }, { status: 400 });
    }

    if (courseLessonId) {
      const lesson = await prisma.courseLesson.findFirst({
        where: { id: courseLessonId, unit: { course: { userId: user!.id } } },
        select: { id: true },
      });
      if (!lesson) return jsonNoStore({ error: "关联课时不存在" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        userId: user!.id,
        title,
        description: description || null,
        date: new Date(date),
        duration: duration || null,
        phase: phase || null,
        subject: subject || null,
        weekStartDate: weekStartDate ? new Date(weekStartDate) : null,
        source: source || null,
        courseLessonId: courseLessonId || null,
      },
    });

    return jsonNoStore({ task });
  } catch (err) {
    return handleApiError(err, "创建任务");
  }
}
