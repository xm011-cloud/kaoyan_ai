export interface ComparablePlanItem {
  title: string;
  subject?: string | null;
  date: string | Date;
  duration?: number | null;
}

export interface WeeklyPlanItemChange {
  title: string;
  subject: string | null;
  fromDate?: string;
  toDate?: string;
  fromDuration?: number;
  toDuration?: number;
}

export interface WeeklyPlanImpact {
  added: WeeklyPlanItemChange[];
  removed: WeeklyPlanItemChange[];
  moved: WeeklyPlanItemChange[];
  durationChanged: WeeklyPlanItemChange[];
  unchangedCount: number;
  previousMinutes: number;
  nextMinutes: number;
  minuteDelta: number;
  requiresConfirmation: boolean;
}

function dateKey(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function identity(item: ComparablePlanItem): string {
  return `${item.subject ?? ""}|${item.title.trim()}`;
}

function asChange(item: ComparablePlanItem): WeeklyPlanItemChange {
  return {
    title: item.title,
    subject: item.subject ?? null,
    fromDate: dateKey(item.date),
    fromDuration: item.duration ?? 0,
  };
}

/** 比较当前生效计划中的未完成任务与候选草稿。已完成任务不应传入，也不会被新版本影响。 */
export function compareWeeklyPlans(
  previous: ComparablePlanItem[],
  next: ComparablePlanItem[],
): WeeklyPlanImpact {
  const previousBuckets = new Map<string, ComparablePlanItem[]>();
  for (const item of previous) {
    const key = identity(item);
    previousBuckets.set(key, [...(previousBuckets.get(key) ?? []), item]);
  }

  const added: WeeklyPlanItemChange[] = [];
  const moved: WeeklyPlanItemChange[] = [];
  const durationChanged: WeeklyPlanItemChange[] = [];
  let unchangedCount = 0;

  for (const item of next) {
    const bucket = previousBuckets.get(identity(item));
    const old = bucket?.shift();
    if (!old) {
      added.push({
        title: item.title,
        subject: item.subject ?? null,
        toDate: dateKey(item.date),
        toDuration: item.duration ?? 0,
      });
      continue;
    }

    const oldDate = dateKey(old.date);
    const nextDate = dateKey(item.date);
    const oldDuration = old.duration ?? 0;
    const nextDuration = item.duration ?? 0;
    if (oldDate !== nextDate) {
      moved.push({
        title: item.title,
        subject: item.subject ?? null,
        fromDate: oldDate,
        toDate: nextDate,
      });
    }
    if (oldDuration !== nextDuration) {
      durationChanged.push({
        title: item.title,
        subject: item.subject ?? null,
        fromDuration: oldDuration,
        toDuration: nextDuration,
      });
    }
    if (oldDate === nextDate && oldDuration === nextDuration) unchangedCount++;
  }

  const removed = [...previousBuckets.values()].flat().map(asChange);
  const previousMinutes = previous.reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const nextMinutes = next.reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const minuteDelta = nextMinutes - previousMinutes;
  const capacityChangeRatio = previousMinutes > 0 ? Math.abs(minuteDelta) / previousMinutes : 0;

  return {
    added,
    removed,
    moved,
    durationChanged,
    unchangedCount,
    previousMinutes,
    nextMinutes,
    minuteDelta,
    requiresConfirmation: removed.length > 0 || moved.length > 0 || capacityChangeRatio >= 0.25,
  };
}
