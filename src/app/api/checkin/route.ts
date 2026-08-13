import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { startOfDay } from "@/lib/date-utils";
import { getMilestone } from "@/lib/milestone";

// GET: 获取打卡记录（支持 ?date=YYYY-MM-DD）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (dateStr) {
      const date = startOfDay(new Date(dateStr));
      const checkIn = await prisma.checkIn.findFirst({
        where: { userId: user!.id, date },
      });
      return jsonNoStore({ checkIn });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: { userId: user!.id },
      orderBy: { date: "desc" },
      take: 30,
    });

    return jsonNoStore({ checkIns });
  } catch (err) {
    return handleApiError(err, "获取打卡记录");
  }
}

// POST: 创建打卡
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { date, duration, status, note } = body;

    if (!date || !duration || !status) {
      return jsonNoStore({ error: "日期、时长和状态为必填项" }, { status: 400 });
    }

    const checkInDate = startOfDay(new Date(date));

    const checkIn = await prisma.checkIn.upsert({
      where: { userId_date: { userId: user!.id, date: checkInDate } },
      create: {
        userId: user!.id, date: checkInDate,
        duration: parseInt(duration), status, note: note || null,
      },
      update: {
        duration: parseInt(duration), status, note: note || null,
      },
    });

    const milestone = await getMilestone(user!.id);

    return jsonNoStore({ checkIn, milestone });
  } catch (err) {
    return handleApiError(err, "创建打卡");
  }
}
