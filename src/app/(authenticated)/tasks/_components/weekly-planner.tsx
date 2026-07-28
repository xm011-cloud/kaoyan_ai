"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface WeekTask {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  duration?: number | null;
  phase?: string | null;
  subject?: string | null;
  completed: boolean;
  source?: string | null;
}

interface JudgeResult {
  score: number;
  strengths: string[];
  issues: { severity: string; description: string; fix: string }[];
  verdict: string;
  summary: string;
}

interface WeeklyPlannerProps {
  weekStart: Date;
  weekTasks: WeekTask[];
  loading: boolean;
  generating: boolean;
  subjects: string[];
  examDate: string;
  daysRemaining: number;
  onWeekChange: (dir: -1 | 1) => void;
  onGenerate: () => void;
  onRegenerateDay: (dateStr: string) => void;
  onToggleComplete: (task: WeekTask) => void;
  onEditTask: (task: WeekTask) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (dateStr: string) => void;
  onJudge: () => void;
  onRegenerateWithFeedback: (feedback: string) => void;
  judgeResult: JudgeResult | null;
  judging: boolean;
}

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function WeeklyPlanner({
  weekStart, weekTasks, loading, generating, subjects, examDate, daysRemaining,
  onWeekChange, onGenerate, onRegenerateDay, onToggleComplete,
  onEditTask, onDeleteTask, onAddTask, onJudge, onRegenerateWithFeedback,
  judgeResult, judging,
}: WeeklyPlannerProps) {
  const [showJudge, setShowJudge] = useState(false);

  // Group tasks by day of week
  const tasksByDay: WeekTask[][] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86400000);
    const ds = d.toISOString().split("T")[0];
    return weekTasks.filter((t) => t.date.startsWith(ds));
  });

  // Count tasks per day
  const tasksPerDay = tasksByDay.map((arr) => arr.length);
  const totalTasks = weekTasks.length;
  const completedTasks = weekTasks.filter((t) => t.completed).length;
  const totalMinutes = weekTasks.reduce((s, t) => s + (t.duration || 0), 0);

  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const hasGenerated = totalTasks > 0;

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border p-4">
        <Button variant="outline" size="sm" onClick={() => onWeekChange(-1)}>◀ 上周</Button>
        <div className="text-center">
          <div className="font-medium">{formatDate(weekStart)} - {formatDate(weekEnd)}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {hasGenerated ? `${totalTasks} 任务 · ${completedTasks}/${totalTasks} 完成 · ${Math.round(totalMinutes / 60)}h` : "未生成计划"}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onWeekChange(1)}>下周 ▶</Button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onGenerate} disabled={generating}>
          {generating ? "生成中..." : hasGenerated ? "🤖 重新生成周计划" : "🤖 生成周计划"}
        </Button>
        {hasGenerated && (
          <>
            <Button variant="outline" onClick={() => { setShowJudge(!showJudge); if (!judgeResult && !showJudge) onJudge(); }} disabled={judging}>
              {judging ? "评审中..." : "🔍 评审周计划"}
            </Button>
          </>
        )}
      </div>

      {/* Judge result */}
      {showJudge && judgeResult && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {judgeResult.verdict === "good" ? "✅" : judgeResult.verdict === "needs_work" ? "⚠️" : "❌"}
              </div>
              <div>
                <h4 className="font-bold">
                  评审得分：
                  <span className={`text-lg ${judgeResult.score >= 80 ? "text-green-600" : judgeResult.score >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                    {judgeResult.score} 分
                  </span>
                </h4>
                <p className="text-sm text-gray-500">{judgeResult.summary}</p>
              </div>
            </div>
            <button onClick={() => setShowJudge(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {judgeResult.strengths.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-green-600 mb-1">👍 优点</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                {judgeResult.strengths.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}

          {judgeResult.issues.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-red-500 mb-1">🔧 可改进 ({judgeResult.issues.length})</h5>
              <div className="space-y-2">
                {judgeResult.issues.map((issue, i) => (
                  <div key={i} className={`text-sm p-2 rounded ${
                    issue.severity === "high" ? "bg-red-50 dark:bg-red-900/20 border-l-2 border-red-400" :
                    issue.severity === "medium" ? "bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400" :
                    "bg-gray-50 dark:bg-gray-900/20 border-l-2 border-gray-300"
                  }`}>
                    <span className="text-xs font-medium text-gray-400 uppercase">{issue.severity}</span>
                    <p className="mt-0.5">{issue.description}</p>
                    <p className="text-xs text-blue-500 mt-0.5">💡 {issue.fix}</p>
                  </div>
                ))}
              </div>
              <Button
                size="sm" variant="outline" className="mt-3"
                onClick={() => {
                  const feedback = judgeResult.issues.map((iss) => `[${iss.severity}] ${iss.description} → ${iss.fix}`).join("; ");
                  onRegenerateWithFeedback(feedback);
                }}
              >
                ↻ 采纳建议重新生成
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Daily task columns */}
      {hasGenerated && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAY_NAMES.map((dayName, i) => {
            const dayDate = new Date(weekStart.getTime() + i * 86400000);
            const ds = dayDate.toISOString().split("T")[0];
            const dayTasks = tasksByDay[i];
            const dayCompleted = dayTasks.filter((t) => t.completed).length;
            const isToday = new Date().toISOString().split("T")[0] === ds;

            return (
              <div key={i} className={`border rounded-lg ${isToday ? "border-blue-300 bg-blue-50/20 dark:border-blue-700 dark:bg-blue-900/5" : "border-gray-200 dark:border-gray-700"}`}>
                <div className={`px-3 py-2 border-b flex items-center justify-between text-xs ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-800/50"}`}>
                  <span>
                    <span className="font-medium">{dayName}</span>
                    <span className="text-gray-400 ml-1">{formatDate(dayDate)}</span>
                    {isToday && <span className="ml-1 text-blue-500 font-medium">今天</span>}
                  </span>
                  <button
                    className="text-gray-400 hover:text-blue-500"
                    title="重新生成这一天"
                    onClick={() => onRegenerateDay(ds)}
                  >
                    ↻
                  </button>
                </div>
                <div className="p-2 space-y-2 min-h-[60px]">
                  {dayTasks.map((task) => (
                    <div key={task.id} className={`text-xs p-2 rounded border group cursor-pointer hover:shadow-sm transition-shadow ${task.completed ? "opacity-50 bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-800"}`}
                      onClick={() => onEditTask(task)}>
                      <div className="flex items-start gap-1">
                        <input type="checkbox" checked={task.completed} onChange={(e) => { e.stopPropagation(); onToggleComplete(task); }}
                          className="mt-0.5 h-3.5 w-3.5 rounded shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={task.completed ? "line-through" : ""}>{task.title}</p>
                          <div className="flex gap-2 mt-1">
                            {task.subject && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">{task.subject}</span>}
                            {task.duration && <span className="text-[10px] text-gray-400">{task.duration}min</span>}
                            {task.source === "manual" && <span className="text-[10px] text-gray-400">✍️</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                          className="text-gray-300 hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    </div>
                  ))}
                  {dayTasks.length === 0 && (
                    <p className="text-[10px] text-gray-300 text-center py-2">暂无任务</p>
                  )}
                  <button onClick={() => onAddTask(ds)}
                    className="w-full text-[10px] text-gray-400 hover:text-blue-500 py-1 border border-dashed rounded text-center transition-colors">
                    + 添加
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasGenerated && !generating && (
        <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-xl border">
          <div className="text-5xl mb-4">📅</div>
          <p className="font-medium">还没有生成这周的学习计划</p>
          <p className="text-sm mt-1">点击上方"生成周计划"，AI 将根据你的目标、进度和阶段自动安排每天的学习任务</p>
        </div>
      )}
    </div>
  );
}
