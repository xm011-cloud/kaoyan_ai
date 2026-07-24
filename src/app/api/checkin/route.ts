import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

// GET: 获取打卡记录（支持 ?date=YYYY-MM-DD）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (dateStr) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const checkIn = await prisma.checkIn.findFirst({
        where: { userId: user!.id, date },
      });

      return NextResponse.json({ checkIn });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: { userId: user!.id },
      orderBy: { date: "desc" },
      take: 30,
    });

    return NextResponse.json({ checkIns });
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
      return NextResponse.json({ error: "日期、时长和状态为必填项" }, { status: 400 });
    }

    const checkInDate = new Date(date);
    checkInDate.setHours(0, 0, 0, 0);

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

    return NextResponse.json({ checkIn });
  } catch (err) {
    return handleApiError(err, "创建打卡");
  }
}
