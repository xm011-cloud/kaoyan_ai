import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getWeekStart, toDateString } from "@/lib/date-utils";

export type ProfileStats = {
  totalDays: number;
  totalMinutes: number;
  thisWeekMinutes: number;
  streak: number;
};

// 打卡统计：数据量小，一次取全量在 JS 里算（避免多次聚合）
// date 是本地 startOfDay 存储，toDateString 比较保持一致（无时区 off-by-one）
async function computeStats(userId: string): Promise<ProfileStats> {
  const checkIns = await prisma.checkIn.findMany({
    where: { userId },
    select: { date: true, duration: true },
  });

  const weekStart = getWeekStart();
  let totalMinutes = 0;
  let thisWeekMinutes = 0;
  const dateSet = new Set<string>();
  for (const c of checkIns) {
    dateSet.add(toDateString(c.date));
    totalMinutes += c.duration;
    if (c.date >= weekStart) thisWeekMinutes += c.duration;
  }

  // 连续打卡：今天有打卡从今天起，否则从昨天起倒推
  let streak = 0;
  const cursor = new Date();
  if (!dateSet.has(toDateString(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dateSet.has(toDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalDays: dateSet.size,
    totalMinutes,
    thisWeekMinutes,
    streak,
  };
}

// GET /api/user/profile          → 自己（含 email）
// GET /api/user/profile?userId=x → 公开视图（绝不含 email，用户不存在 404）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatar: true, createdAt: true },
      });
      if (!dbUser) return jsonNoStore({ error: "用户不存在" }, { status: 404 });
      const stats = await computeStats(userId);
      return jsonNoStore({
        id: dbUser.id,
        name: dbUser.name,
        avatar: dbUser.avatar,
        createdAt: dbUser.createdAt.toISOString(),
        stats,
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { id: true, name: true, avatar: true, email: true, createdAt: true },
    });
    if (!dbUser) return jsonNoStore({ error: "用户不存在" }, { status: 404 });
    const stats = await computeStats(user!.id);
    return jsonNoStore({
      id: dbUser.id,
      name: dbUser.name,
      avatar: dbUser.avatar,
      email: dbUser.email,
      createdAt: dbUser.createdAt.toISOString(),
      stats,
    });
  } catch (err) {
    return handleApiError(err, "获取个人资料");
  }
}

// PUT /api/user/profile — 只更新昵称
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonNoStore({ error: "昵称不能为空" }, { status: 400 });
    if (name.length > 30) {
      return jsonNoStore({ error: "昵称不能超过 30 个字" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user!.id }, data: { name } });
    return jsonNoStore({ success: true, name });
  } catch (err) {
    return handleApiError(err, "保存个人资料");
  }
}
