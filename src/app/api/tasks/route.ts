import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

// GET: 获取任务列表（支持 ?date=YYYY-MM-DD 筛选）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    const where: Record<string, unknown> = { userId: user!.id };
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
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
    const { title, description, date, duration, phase } = body;

    if (!title || !date) {
      return NextResponse.json({ error: "标题和日期为必填项" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        userId: user!.id,
        title,
        description: description || null,
        date: new Date(date),
        duration: duration || null,
        phase: phase || null,
      },
    });

    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err, "创建任务");
  }
}
