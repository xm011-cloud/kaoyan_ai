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
      // 兼容新旧 weekStartDate 口径：新代码存「本地周一」，历史任务存「本地周日」(旧 UTC 串逻辑)。
      // 用 [本地周日, 本地周二) 窗口同时覆盖两者，避免历史计划从周视图消失。
      const ws = new Date(weekStart); // 本地周一（UTC 午夜）
      const winStart = new Date(ws.getTime() - 86400000); // 本地周日
      const winEnd = new Date(ws.getTime() + 86400000); // 本地周二（排除下一周）
      where.weekStartDate = { gte: winStart, lt: winEnd };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return jsonNoStore({ tasks });
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
    const { title, description, date, duration, phase, subject, weekStartDate, source } = body;

    if (!title || !date) {
      return jsonNoStore({ error: "标题和日期为必填项" }, { status: 400 });
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
      },
    });

    return jsonNoStore({ task });
  } catch (err) {
    return handleApiError(err, "创建任务");
  }
}
