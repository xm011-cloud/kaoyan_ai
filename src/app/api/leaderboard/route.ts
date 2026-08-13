import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getWeekStart } from "@/lib/date-utils";

type Period = "week" | "month" | "all";

// 学习圈排行榜：按打卡总时长排名（并列时打卡天数多者靠前）
// groupBy 无法 include 关系 → 两步查询：先聚合 CheckIn，再补 User 信息
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const period = (request.nextUrl.searchParams.get("period") ?? "week") as Period;
    if (!["week", "month", "all"].includes(period)) {
      return jsonNoStore({ error: "无效的 period" }, { status: 400 });
    }

    const now = new Date();
    const start =
      period === "week"
        ? getWeekStart(now) // 本地时区周一 0 点（CheckIn.date 也是本地 startOfDay 存储，一致）
        : period === "month"
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : null;

    // 上一周期窗口（用于"本周 vs 上周"个人对比，软化非零和）
    const prevStart =
      period === "week"
        ? new Date(start!.getTime() - 7 * 86400000)
        : period === "month"
          ? new Date(start!.getFullYear(), start!.getMonth() - 1, 1)
          : null;
    const prevEnd = prevStart ? start : null;

    const rows = await prisma.checkIn.groupBy({
      by: ["userId"],
      where: start ? { date: { gte: start } } : {},
      _sum: { duration: true },
      _count: { _all: true },
    });

    // 在 JS 里排序（小圈子数据量小），并按 (时长, 天数) 双重排序
    const stats = rows
      .map((r) => ({
        userId: r.userId,
        duration: r._sum.duration ?? 0,
        days: r._count._all,
      }))
      .sort((a, b) => b.duration - a.duration || b.days - a.days);

    if (stats.length === 0) {
      return jsonNoStore({ period, leaderboard: [], callerRank: null, callerCompare: null });
    }

    // 第二步：补用户信息（name 优先，否则脱敏邮箱前缀）
    const users = await prisma.user.findMany({
      where: { id: { in: stats.map((s) => s.userId) } },
      select: { id: true, name: true, email: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const ranked = stats.map((s, i) => {
      const u = userMap.get(s.userId);
      const displayName =
        u?.name ||
        (u?.email ? u.email.split("@")[0] : `用户${s.userId.slice(0, 4)}`);
      return {
        rank: i + 1,
        userId: s.userId,
        duration: s.duration,
        days: s.days,
        displayName,
        avatar: u?.avatar ?? null,
        isCurrentUser: s.userId === user!.id,
      };
    });

    const callerIndex = ranked.findIndex((r) => r.isCurrentUser);

    // 本人"本周 vs 上周"对比（不参与排名，只做自我参照）
    let callerCompare: {
      currentDuration: number;
      currentDays: number;
      previousDuration: number | null;
      previousDays: number | null;
    } | null = null;
    if (callerIndex >= 0) {
      const me = ranked[callerIndex];
      callerCompare = {
        currentDuration: me.duration,
        currentDays: me.days,
        previousDuration: null,
        previousDays: null,
      };
      if (prevStart && prevEnd) {
        const prev = await prisma.checkIn.groupBy({
          by: ["userId"],
          where: { userId: user!.id, date: { gte: prevStart, lt: prevEnd } },
          _sum: { duration: true },
          _count: { _all: true },
        });
        callerCompare.previousDuration = prev[0]?._sum.duration ?? 0;
        callerCompare.previousDays = prev[0]?._count._all ?? 0;
      }
    }

    return jsonNoStore({
      period,
      leaderboard: ranked.slice(0, 100),
      callerRank: callerIndex >= 0 ? callerIndex + 1 : null,
      callerCompare,
    });
  } catch (err) {
    return handleApiError(err, "获取排行榜");
  }
}
