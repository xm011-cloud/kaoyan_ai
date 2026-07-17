"use client";

import dynamic from "next/dynamic";
import { Heatmap } from "./heatmap";

// StatsCharts uses recharts (~2MB), load client-only to keep SSR bundle lean
const StatsCharts = dynamic(
  () => import("./stats-charts").then((mod) => ({ default: mod.StatsCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="text-center py-6 text-sm text-gray-400">加载图表...</div>
    ),
  }
);

interface CheckIn {
  id: string; date: string; duration: number; status: string;
}
interface Task {
  id: string; title: string; phase?: string | null; completed: boolean; duration?: number;
}

export function DashboardCharts({
  checkIns,
  tasks,
}: {
  checkIns: CheckIn[];
  tasks: Task[];
}) {
  const heatmapData = checkIns.map(c => {
    const d = new Date(c.date);
    d.setHours(0, 0, 0, 0);
    return { date: d.toISOString().split("T")[0], duration: c.duration };
  });

  return (
    <div className="space-y-6">
      {/* 热力图 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <h3 className="font-semibold mb-4">学习日历</h3>
        <Heatmap checkIns={heatmapData} months={3} />
      </div>

      {/* 统计图表 — 客户端动态加载 */}
      <StatsCharts checkIns={checkIns.map(c => {
        const d = new Date(c.date); d.setHours(0,0,0,0);
        return { date: d.toISOString(), duration: c.duration, status: c.status };
      })} tasks={tasks} />
    </div>
  );
}
