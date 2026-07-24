/**
 * 日期工具函数 — 统一项目中 30+ 处重复的日期计算逻辑。
 */

/** 将日期重置为当天 00:00:00.000 */
export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/** 将日期设为当天 23:59:59.999 */
export function endOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}

/** 获取本周一起始（周一 = 0） */
export function getWeekStart(d: Date = new Date()): Date {
  const n = startOfDay(d);
  const day = n.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 周日回退 6 天
  n.setDate(n.getDate() + diff);
  return n;
}

/** 获取本周日结束 */
export function getWeekEnd(d: Date = new Date()): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

/** Date → YYYY-MM-DD 字符串 */
export function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Date → YYYY-MM-DD HH:MM 字符串 */
export function toDateTimeString(d: Date): string {
  const ds = toDateString(d);
  const t = d.toTimeString().slice(0, 5);
  return `${ds} ${t}`;
}

/** 两个日期相差天数 */
export function daysBetween(a: Date, b: Date): number {
  const aStart = startOfDay(a);
  const bStart = startOfDay(b);
  return Math.round(
    (bStart.getTime() - aStart.getTime()) / 86_400_000
  );
}

/** 获取 N 天前的日期（0 点） */
export function daysAgo(n: number, from: Date = new Date()): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() - n);
  return d;
}

/** 中文星期名 */
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function getDayName(d: Date): string {
  return DAY_NAMES[d.getDay()];
}
