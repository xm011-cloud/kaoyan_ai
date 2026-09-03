import { addLocalDays } from "@/lib/date-utils";

export interface WeeklyAdjustmentConstraints {
  weeklyHours: number | null;
  unavailableWeekdays: number[];
  reduceSubjects: string[];
  increaseSubjects: string[];
}

export interface AdjustablePlanTask {
  title: string;
  description: string;
  date: string;
  duration: number;
  phase: string;
  subject: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
};

export function parseWeeklyAdjustment(
  request: string,
  subjects: string[],
): WeeklyAdjustmentConstraints {
  const hoursMatch = request.match(/(?:本周|这周)?[^，。；\n]{0,10}?(\d+(?:\.\d+)?)\s*(?:个)?小时/);
  const weeklyHours = hoursMatch ? Math.min(Math.max(Number(hoursMatch[1]), 1), 100) : null;
  const unavailableWeekdays = new Set<number>();
  const dayPattern = /周([一二三四五六日天])([^，。；\n]{0,12})/g;
  for (const match of request.matchAll(dayPattern)) {
    if (/(没空|没时间|不能|不安排|休息|有事)/.test(match[2])) {
      unavailableWeekdays.add(WEEKDAY_MAP[match[1]]);
    }
  }

  const clauses = request.split(/[，。；;\n]/).map((clause) => clause.trim()).filter(Boolean);
  const reduceSubjects: string[] = [];
  const increaseSubjects: string[] = [];
  for (const subject of subjects) {
    for (const clause of clauses) {
      if (!clause.includes(subject)) continue;
      if (/(少一点|少些|减少|降低|压缩|别太多)/.test(clause)) reduceSubjects.push(subject);
      if (/(多一点|增加|加强|优先|重点)/.test(clause)) increaseSubjects.push(subject);
    }
  }

  return {
    weeklyHours,
    unavailableWeekdays: [...unavailableWeekdays].sort(),
    reduceSubjects: [...new Set(reduceSubjects)],
    increaseSubjects: [...new Set(increaseSubjects)],
  };
}

export function applyWeeklyAdjustment(
  tasks: AdjustablePlanTask[],
  constraints: WeeklyAdjustmentConstraints,
  weekStart: string,
): AdjustablePlanTask[] {
  const unavailable = new Set(constraints.unavailableWeekdays);
  const reduced = new Set(constraints.reduceSubjects);
  const increased = new Set(constraints.increaseSubjects);
  const seenReduced = new Map<string, number>();

  let adjusted = tasks.filter((task) => {
    const weekday = new Date(`${task.date}T00:00:00`).getDay();
    if (unavailable.has(weekday)) return false;
    if (!reduced.has(task.subject)) return true;
    const count = seenReduced.get(task.subject) ?? 0;
    seenReduced.set(task.subject, count + 1);
    return count % 2 === 0;
  });

  for (const subject of increased) {
    const source = tasks.find((task) => task.subject === subject);
    if (!source) continue;
    const availableDates = Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index))
      .filter((date) => !unavailable.has(new Date(`${date}T00:00:00`).getDay()));
    if (availableDates.length === 0) continue;
    const counts = new Map(availableDates.map((date) => [date, adjusted.filter((task) => task.date === date).length]));
    const date = availableDates.sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0];
    adjusted.push({
      ...source,
      title: `${subject} - 重点加练`,
      description: `根据本周调整要求，增加一次${subject}重点巩固或专项练习。`,
      date,
      duration: Math.min(source.duration || 60, 90),
    });
  }

  if (constraints.weeklyHours) {
    const limit = Math.round(constraints.weeklyHours * 60);
    const prioritized = [...adjusted].sort((a, b) => {
      const score = (task: AdjustablePlanTask) => increased.has(task.subject) ? 2 : reduced.has(task.subject) ? 0 : 1;
      return score(b) - score(a) || a.date.localeCompare(b.date);
    });
    const selected: AdjustablePlanTask[] = [];
    let minutes = 0;
    for (const task of prioritized) {
      if (selected.length > 0 && minutes + task.duration > limit) continue;
      selected.push(task);
      minutes += task.duration;
    }
    adjusted = selected;
  }

  return adjusted.sort((a, b) => a.date.localeCompare(b.date));
}
