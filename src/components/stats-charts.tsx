"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

interface CheckIn {
  date: string;   // ISO string
  duration: number; // minutes
  status: string;
}

interface Task {
  title: string;
  phase?: string | null;
  completed: boolean;
  duration?: number;
}

interface Props {
  checkIns: CheckIn[];
  tasks: Task[];
}

const WEEK_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
const STATUS_COLORS: Record<string, string> = { good: "#22C55E", normal: "#EAB308", tired: "#EF4444" };
const STATUS_LABELS: Record<string, string> = { good: "状态好", normal: "一般", tired: "疲惫" };

export function StatsCharts({ checkIns, tasks }: Props) {
  // ── 每周趋势数据 ──
  const weeklyData = useMemo(() => {
    if (checkIns.length === 0) return [];
    const sorted = [...checkIns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const map = new Map<string, { week: string; minutes: number; days: number }>();
    sorted.forEach(c => {
      const d = new Date(c.date);
      d.setHours(0,0,0,0);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
      const key = monday.toISOString().split("T")[0];
      const existing = map.get(key) || { week: key, minutes: 0, days: 0 };
      existing.minutes += c.duration;
      existing.days += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).map(w => ({
      ...w,
      week: `${new Date(w.week).getMonth() + 1}/${new Date(w.week).getDate()}`,
    })).slice(-12);
  }, [checkIns]);

  // ── 阶段任务分布 ──
  const phaseData = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    tasks.forEach(t => {
      const p = t.phase || "未分类";
      const e = map.get(p) || { total: 0, completed: 0 };
      e.total += 1;
      if (t.completed) e.completed += 1;
      map.set(p, e);
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name, value: v.total, completed: v.completed,
    }));
  }, [tasks]);

  // ── 本周每日时长 ──
  const dailyData = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
      const dStr = d.toISOString().split("T")[0];
      const mins = checkIns.filter(c => {
        const cd = new Date(c.date); cd.setHours(0,0,0,0);
        return cd.toISOString().split("T")[0] === dStr;
      }).reduce((s, c) => s + c.duration, 0);
      return { name: dayNames[i], hours: +(mins / 60).toFixed(1), isToday: i === today.getDay() };
    });
  }, [checkIns]);

  // ── 状态分布 ──
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    checkIns.forEach(c => {
      map.set(c.status, (map.get(c.status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || "#9CA3AF",
    }));
  }, [checkIns]);

  if (checkIns.length === 0 && tasks.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        还没有足够的数据来生成图表，先开始学习和打卡吧
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 本周每日柱状图 + 状态饼图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 本周每日 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-3">本周每日学习时长</h3>
          {dailyData.every(d => d.hours === 0) ? (
            <p className="text-sm text-gray-400 py-8 text-center">本周暂无打卡</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip formatter={(v) => [`${v} 小时`, "学习时长"]} />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? "#3B82F6" : "#93C5FD"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 状态饼图 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-3">学习状态分布</h3>
          {statusData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">暂无打卡数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}天`}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 每周趋势折线 + 阶段柱状 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 每周趋势 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-3">每周学习时长趋势</h3>
          {weeklyData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">至少需要一周数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip formatter={(v) => [`${(Number(v) / 60).toFixed(1)} 小时`, "学习时长"]} />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="学习时长"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 阶段分布 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-3">各阶段任务进度</h3>
          {phaseData.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">暂无任务数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={phaseData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                <Tooltip />
                <Bar dataKey="completed" stackId="a" fill="#22C55E" name="已完成" radius={[0, 0, 0, 0]} />
                <Bar dataKey={(d: { total: number; completed: number }) => d.total - d.completed} stackId="a" fill="#E5E7EB" name="未完成" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
