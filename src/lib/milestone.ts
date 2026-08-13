import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd, startOfDay } from "@/lib/date-utils";

/**
 * 心路成长里程碑统计（服务端）
 *
 * 为打卡成功态 / 周报等"人类读入口"提供具体数字肯定，
 * 遵循表达规范：肯定事实，不泛泛而谈。
 */
export interface Milestone {
  totalCheckIns: number; // 累计打卡天数
  currentStreak: number; // 连续打卡天数（到今天为止）
  weekCheckIns: number; // 本周打卡天数
  unreviewedWrongCount: number; // 待复习错题数
  completedMilestones: number; // 学习路径已完成的里程碑数
}

export async function getMilestone(userId: string): Promise<Milestone> {
  const [checkIns, weekStart, unreviewedWrongCount, completedMilestones] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
    getWeekStart(startOfDay(new Date())),
    prisma.wrongQuestion.count({
      where: { userId, reviewed: false },
    }),
    prisma.studyPathMilestone.count({
      where: { studyPath: { userId }, completedAt: { not: null } },
    }),
  ]);

  // 累计 + 连续打卡天数
  const totalCheckIns = checkIns.length;
  const dateSet = new Set(
    checkIns.map((c) => c.date.toISOString().split("T")[0])
  );
  let currentStreak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // 今天没打卡也允许保留昨天开始的连续记录（打卡动作本身会刷新）
  for (let i = 0; i < 366; i++) {
    const key = cursor.toISOString().split("T")[0];
    if (dateSet.has(key)) {
      currentStreak++;
    } else if (i > 0) {
      break; // 允许今天缺席不打断昨天之前的连续
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // 本周打卡天数
  const weekEnd = getWeekEnd(startOfDay(new Date()));
  const weekCheckIns = checkIns.filter((c) => c.date >= weekStart && c.date <= weekEnd).length;

  return {
    totalCheckIns,
    currentStreak,
    weekCheckIns,
    unreviewedWrongCount,
    completedMilestones,
  };
}
