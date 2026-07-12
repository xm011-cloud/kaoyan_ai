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
  const { weeks, monthLabels, color } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // go back `months` months
    const start = new Date(today);
    start.setMonth(start.getMonth() - months + 1);
    start.setDate(1);
    // align to Sunday
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    const end = new Date(today);
    // align to next Saturday
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

    // group into weeks (columns)
    const wks: { date: string; level: number }[][] = [];
    let currentWeek: { date: string; level: number }[] = [];
    for (const d of days) {
      currentWeek.push({ date: d.date, level: d.level });
      if (d.day === 6) {
        wks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) wks.push(currentWeek);

    // month labels
    const mls: { label: string; col: number }[] = [];
    let prevMonth = -1;
    wks.forEach((week, wi) => {
      const d = new Date(week[0]?.date);
      const m = d.getMonth();
      if (m !== prevMonth) {
        mls.push({ label: `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}`, col: wi });
        prevMonth = m;
      }
    });

    function getColor(level: number) {
      if (level === 0) return "bg-gray-100 dark:bg-gray-800";
      if (level === 1) return "bg-green-200 dark:bg-green-900/50";
      if (level === 2) return "bg-green-400 dark:bg-green-600";
      if (level === 3) return "bg-green-500 dark:bg-green-500";
      return "bg-green-600 dark:bg-green-400";
    }

    return { weeks: wks, monthLabels: mls, color: getColor };
  }, [checkIns, months]);

  const dayLabels = ["", "一", "", "三", "", "五", ""];

  return (
    <div className="overflow-x-auto -mx-2">
      {/* month labels */}
      <div className="flex ml-8 mb-1 gap-0">
        {monthLabels.map((ml, i) => (
          <div
            key={i}
            className="text-xs text-gray-400"
            style={{ marginLeft: i === 0 ? ml.col * 13 : (ml.col - monthLabels[i - 1].col) * 13 - 30 }}
          >
            {ml.label}
          </div>
        ))}
      </div>

      <div className="flex gap-0.5">
        {/* day-of-week labels */}
        <div className="flex flex-col gap-0.5 mr-1.5 pt-0">
          {dayLabels.map((l, i) => (
            <div key={i} className="w-5 h-3 text-[10px] text-gray-400 leading-3">
              {l}
            </div>
          ))}
        </div>

        {/* grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                className="w-3 h-3 rounded-sm"
                style={{ gridRow: dayLabels[di] ? "auto" : undefined }}
                title={`${day.date}: ${day.level > 0 ? "已打卡" : "未打卡"}`}
              >
                <div className={`w-3 h-3 rounded-sm ${color(day.level)}`} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* legend */}
      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400 ml-8">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/50" />
        <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-600" />
        <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-500" />
        <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-400" />
        <span>多</span>
      </div>
    </div>
  );
}
