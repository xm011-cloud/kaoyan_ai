import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取提醒设置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { reminderEnabled: true, reminderTime: true, reminderDays: true },
    });
    return jsonNoStore({
      reminderEnabled: dbUser?.reminderEnabled ?? false,
      reminderTime: dbUser?.reminderTime ?? "09:00",
      reminderDays: dbUser?.reminderDays ?? ["1", "2", "3", "4", "5"],
    });
  } catch (err) {
    return handleApiError(err, "获取提醒设置");
  }
}

// PUT: 保存提醒设置
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { reminderEnabled, reminderTime, reminderDays } = body;

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        reminderEnabled: reminderEnabled ?? false,
        reminderTime: reminderTime ?? "09:00",
        reminderDays: reminderDays ?? ["1", "2", "3", "4", "5"],
      },
    });
    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "保存提醒设置");
  }
}
