"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AiWaiting } from "@/components/ai-waiting";
import { toDateString, startOfDay } from "@/lib/date-utils";
import type { AiWaitPhase } from "@/hooks/use-ai-task";

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
  sprintMode?: boolean;
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
  generatingPhase: AiWaitPhase;
  generatingEstimate: string;
  onCancelGenerate: () => void;
  judgingPhase: AiWaitPhase;
  judgingEstimate: string;
  onCancelJudge: () => void;
}

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function WeeklyPlanner({
  weekStart, weekTasks, loading, generating, subjects, examDate, daysRemaining, sprintMode,
  onWeekChange, onGenerate, onRegenerateDay, onToggleComplete,
  onEditTask, onDeleteTask, onAddTask, onJudge, onRegenerateWithFeedback,
  judgeResult, judging,
  generatingPhase, generatingEstimate, onCancelGenerate,
  judgingPhase, judgingEstimate, onCancelJudge,
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
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border/50 p-4">
        <Button variant="outline" size="sm" onClick={() => onWeekChange(-1)}>◀ 上周</Button>
        <div className="text-center">
          <div className="font-medium flex items-center justify-center gap-1.5">
            {formatDate(weekStart)} - {formatDate(weekEnd)}
            {sprintMode && (
              <span className="text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">冲刺</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {hasGenerated ? `${totalTasks} 任务 · ${completedTasks}/${totalTasks} 完成 · ${Math.round(totalMinutes / 60)}h` : "未生成计划"}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onWeekChange(1)}>下周 ▶</Button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={onGenerate} disabled={generating}>
          {generating ? "生成中..." : hasGenerated ? "🤖 重新生成周计划" : "🤖 生成周计划"}
        </Button>
        {generating && <AiWaiting variant="inline" phase={generatingPhase} estimate={generatingEstimate} onCancel={onCancelGenerate} />}
        {hasGenerated && (
          <>
            <Button variant="outline" onClick={() => { setShowJudge(!showJudge); if (!judgeResult && !showJudge) onJudge(); }} disabled={judging}>
              {judging ? "评审中..." : "🔍 评审周计划"}
            </Button>
            {judging && <AiWaiting variant="inline" phase={judgingPhase} estimate={judgingEstimate} onCancel={onCancelJudge} />}
          </>
        )}
      </div>

      {/* Judge result */}
      {showJudge && judgeResult && (
        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
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
                <p className="text-sm text-muted-foreground">{judgeResult.summary}</p>
              </div>
            </div>
            <button onClick={() => setShowJudge(false)} className="text-muted-foreground hover:text-foreground" aria-label="关闭">✕</button>
          </div>

          {judgeResult.strengths.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-green-600 mb-1">👍 优点</h5>
              <ul className="text-sm text-muted-foreground space-y-0.5">
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
                    "bg-muted border-l-2 border-border/50"
                  }`}>
                    <span className="text-xs font-medium text-muted-foreground uppercase">{issue.severity}</span>
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

      {/* Daily task columns —— 始终显示：未生成的周也能自己手动添加任务 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          {DAY_NAMES.map((dayName, i) => {
            const dayDate = new Date(weekStart.getTime() + i * 86400000);
            const ds = dayDate.toISOString().split("T")[0];
            const dayTasks = tasksByDay[i];
            const dayCompleted = dayTasks.filter((t) => t.completed).length;
            const isToday = toDateString(startOfDay(new Date())) === ds;

            return (
              <div key={i} className={`border border-border/50 rounded-lg ${isToday ? "border-brand/40 bg-brand/5" : "border-border/50"}`}>
                <div className={`px-3 py-2 border-b flex items-center justify-between text-xs ${isToday ? "bg-brand/10" : "bg-muted/50"}`}>
                  <span>
                    <span className="font-medium">{dayName}</span>
                    <span className="text-muted-foreground ml-1">{formatDate(dayDate)}</span>
                    {isToday && <span className="ml-1 text-blue-500 font-medium">今天</span>}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-brand"
                    title="重新生成这一天"
                    aria-label={`重新生成 ${dayName} 计划`}
                    onClick={() => onRegenerateDay(ds)}
                  >
                    ↻
                  </button>
                </div>
                <div className="p-2 space-y-2 min-h-[60px]">
                  {dayTasks.map((task) => (
                    <div key={task.id} className={`text-xs p-2 rounded border group cursor-pointer hover:shadow-sm transition-shadow ${task.completed ? "opacity-50 bg-muted/50" : "bg-card"}`}
                      onClick={() => onEditTask(task)}>
                      <div className="flex items-start gap-1">
                        <input type="checkbox" checked={task.completed} onChange={(e) => { e.stopPropagation(); onToggleComplete(task); }}
                          className="mt-0.5 h-3.5 w-3.5 rounded shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={task.completed ? "line-through" : ""}>{task.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.subject && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded truncate max-w-full">{task.subject}</span>}
                            {task.duration && <span className="text-[10px] text-muted-foreground">{task.duration}min</span>}
                            {task.source === "manual" && <span className="text-[10px] text-muted-foreground">✍️</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                          className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="删除任务">✕</button>
                      </div>
                    </div>
                  ))}
                  {dayTasks.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/60 text-center py-2">暂无任务</p>
                  )}
                  <button onClick={() => onAddTask(ds)}
                    className="w-full text-[10px] text-muted-foreground hover:text-brand py-1 border border-dashed border-border/50 rounded text-center transition-colors">
                    + 添加
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {!hasGenerated && !generating && (
        <div className="text-center py-6 text-muted-foreground bg-card rounded-2xl border border-dashed border-border/50">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium">这周还没有计划</p>
          <p className="text-sm mt-1">点每天的「＋」自己安排任务，或点上方「生成周计划」让 AI 来排；自己写好后可「评审」让 AI 提建议。</p>
        </div>
      )}
    </div>
  );
}
