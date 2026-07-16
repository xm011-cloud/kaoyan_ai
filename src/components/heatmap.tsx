"use client";

import { useMemo } from "react";

interface CheckInDay {
  date: string; // YYYY-MM-DD
  duration: number; // minutes
}

interface HeatmapProps {
  checkIns: CheckInDay[];
  months?: number; // show last N months
}

export function Heatmap({ checkIns, months = 3 }: HeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setMonth(start.getMonth() - months + 1);
    start.setDate(1);
    // align to Sunday
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const days: { date: string; level: number; day: number }[] = [];
    const cursor = new Date(start);

    const durationMap = new Map<string, number>();
    for (const c of checkIns) durationMap.set(c.date, c.duration);

    while (cursor <= end) {
      const ds = cursor.toISOString().split("T")[0];
      const mins = durationMap.get(ds) || 0;
      let level = 0;
      if (mins > 0) level = 1;
      if (mins >= 60) level = 2;
      if (mins >= 180) level = 3;
      if (mins >= 300) level = 4;

      days.push({ date: ds, level, day: cursor.getDay() });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Weeks as arrays of 7 days (Sun-Sat), padded with null for partial weeks
    const wks: ({ date: string; level: number } | null)[][] = [];
    let currentWeek: ({ date: string; level: number } | null)[] = [];

    // Pad the first week: fill empty slots before start day
    const firstDay = days[0]?.day ?? 0;
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (const d of days) {
      currentWeek.push({ date: d.date, level: d.level });
      if (d.day === 6) {
        // pad rest of week if needed
        while (currentWeek.length < 7) currentWeek.push(null);
        wks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      wks.push(currentWeek);
    }

    // Month labels: track which column index each month starts at
    const mls: { label: string; col: number }[] = [];
    let prevMonth = -1;
    wks.forEach((week, wi) => {
      const firstReal = week.find(d => d !== null);
      if (!firstReal) return;
      const m = new Date(firstReal.date).getMonth();
      if (m !== prevMonth) {
        mls.push({
          label: `${firstReal.date.slice(0, 4)}-${String(m + 1).padStart(2, "0")}`,
          col: wi,
        });
        prevMonth = m;
      }
    });

    // Every 2nd month label gets hidden to avoid overlap
    const filteredLabels: { label: string; col: number; visible: boolean }[] = [];
    let count = 0;
    for (const ml of mls) {
      filteredLabels.push({ ...ml, visible: count % 2 === 0 });
      count++;
    }

    return { weeks: wks, monthLabels: filteredLabels };
  }, [checkIns, months]);

  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];

  const CELL = "w-3.5 h-3.5 rounded-[2px]";
  const getColor = (level: number) => {
    if (level === 0) return "bg-gray-100 dark:bg-gray-800";
    if (level === 1) return "bg-green-200 dark:bg-green-900/50";
    if (level === 2) return "bg-green-400 dark:bg-green-600";
    if (level === 3) return "bg-green-500 dark:bg-green-500";
    return "bg-green-600 dark:bg-green-400";
  };

  return (
    <div className="overflow-x-auto">
      {/* Month labels */}
      <div className="flex mb-1" style={{ paddingLeft: 28 }}>
        {monthLabels.map((ml, i) => (
          <span
            key={i}
            className="text-[10px] text-gray-400 shrink-0"
            style={{
              marginLeft: i === 0 ? ml.col * 16 : (ml.col - monthLabels[i - 1].col) * 16,
              visibility: ml.visible ? "visible" : "hidden",
            }}
          >
            {ml.label}
          </span>
        ))}
      </div>

      {/* Grid + row labels */}
      <div className="flex">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[3px] mr-2 shrink-0" style={{ paddingTop: 3 }}>
          {dayLabels.map((l, i) => (
            <div key={i} className="w-5 text-[10px] text-gray-400 leading-3">
              {l}
            </div>
          ))}
        </div>

        {/* Grid columns */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                if (!day) return <div key={di} className={CELL} />;
                return (
                  <div
                    key={di}
                    className={`${CELL} ${getColor(day.level)}`}
                    title={`${day.date}${day.level > 0 ? " · 已打卡" : " · 未打卡"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-400" style={{ paddingLeft: 28 }}>
        <span>少</span>
        <div className={`${CELL} bg-gray-100 dark:bg-gray-800`} />
        <div className={`${CELL} bg-green-200 dark:bg-green-900/50`} />
        <div className={`${CELL} bg-green-400 dark:bg-green-600`} />
        <div className={`${CELL} bg-green-500 dark:bg-green-500`} />
        <div className={`${CELL} bg-green-600 dark:bg-green-400`} />
        <span>多</span>
      </div>
    </div>
  );
}
