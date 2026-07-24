import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

// GET: 获取番茄钟会话记录（支持 ?date=YYYY-MM-DD）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await prisma.pomodoroSession.findMany({
      where: { userId: user!.id, createdAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    return handleApiError(err, "获取番茄钟记录");
  }
}

// POST: 创建番茄钟会话记录
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { type, plannedMinutes, actualSeconds, status, startedAt, endedAt } = body;

    if (!type || plannedMinutes === undefined || actualSeconds === undefined || !startedAt || !endedAt) {
      return NextResponse.json(
        { error: "type, plannedMinutes, actualSeconds, startedAt, endedAt are required" },
        { status: 400 }
      );
    }

    const validTypes = ["focus", "short_break", "long_break"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "type 只能为 focus, short_break, long_break" }, { status: 400 });
    }

    const session = await prisma.pomodoroSession.create({
      data: {
        userId: user!.id, type, plannedMinutes, actualSeconds,
        status: status || "completed",
        startedAt: new Date(startedAt), endedAt: new Date(endedAt),
      },
    });

    return NextResponse.json({ session });
  } catch (err) {
    return handleApiError(err, "记录番茄钟");
  }
}
