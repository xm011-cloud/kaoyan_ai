/**
 * 时间格式化工具
 *
 * 从 practice/page.tsx 和 pomodoro 组件提取的共用 formatTime 函数。
 */

/** 将秒数格式化为 MM:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
