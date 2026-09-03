"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AiWaiting } from "@/components/ai-waiting";
import { toLocalDateString } from "@/lib/date-utils";
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

interface WeeklyPlanDraftView {
  id: string;
  version: number;
  objective: string;
  rationale: string;
  successCriteria: string[];
  plannedMinutes: number;
  items: Array<Omit<WeekTask, "id" | "completed">>;
  adjustmentRequest?: string | null;
  constraints?: {
    weeklyHours?: number | null;
    unavailableWeekdays?: number[];
    reduceSubjects?: string[];
    increaseSubjects?: string[];
  } | null;
  impact: {
    added: Array<{ title: string }>;
    removed: Array<{ title: string }>;
    moved: Array<{ title: string; fromDate?: string; toDate?: string }>;
    durationChanged: Array<{ title: string; fromDuration?: number; toDuration?: number }>;
    unchangedCount: number;
    previousMinutes: number;
    nextMinutes: number;
    minuteDelta: number;
    requiresConfirmation: boolean;
  };
}

interface WeeklyPlanVersionView {
  id: string;
  version: number;
  status: string;
  objective: string;
  plannedMinutes: number;
  adjustmentRequest?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
}

interface WeeklyPlannerProps {
  weekStart: Date;
  weekTasks: WeekTask[];
  draftPlan: WeeklyPlanDraftView | null;
  planVersions: WeeklyPlanVersionView[];
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
  onConfirmDraft: () => void;
  onDiscardDraft: () => void;
  onAdjust: (request: string) => Promise<void>;
  initialAdjustment?: string;
}

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function WeeklyPlanner({
  weekStart, weekTasks, draftPlan, planVersions, loading, generating, subjects, examDate, daysRemaining, sprintMode,
  onWeekChange, onGenerate, onRegenerateDay, onToggleComplete,
  onEditTask, onDeleteTask, onAddTask, onJudge, onRegenerateWithFeedback,
  judgeResult, judging,
  generatingPhase, generatingEstimate, onCancelGenerate,
  judgingPhase, judgingEstimate, onCancelJudge,
  onConfirmDraft, onDiscardDraft, onAdjust,
  initialAdjustment = "",
}: WeeklyPlannerProps) {
  const [showJudge, setShowJudge] = useState(false);
  const [adjustment, setAdjustment] = useState("");

  useEffect(() => {
    if (initialAdjustment) setAdjustment(initialAdjustment);
  }, [initialAdjustment]);

  // Group tasks by day of week。
  // 日列必须用「本地历法日期串」:任务 date 存的是 UTC 午夜(new Date("YYYY-MM-DD")),
  // 若用 d.toISOString()(UTC 串)分组,UTC+8 用户会整体错位一天、跨午夜的甚至落进下周不可见。
  const tasksByDay: WeekTask[][] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86400000);
    const ds = toLocalDateString(d);
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

      <div id="weekly-plan-adjustment" className="scroll-mt-20 rounded-2xl border border-border/50 bg-card p-4">
        <label htmlFor="weekly-plan-adjustment-input" className="text-sm font-medium">直接告诉我这周怎么调整</label>
        <p className="mt-1 text-xs text-muted-foreground">例如：这周只有 10 小时，周三没空，数学少一点，英语重点加强。</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <textarea
            id="weekly-plan-adjustment-input"
            value={adjustment}
            onChange={(event) => setAdjustment(event.target.value)}
            placeholder="描述你的时间变化、不可用日期或科目侧重……"
            rows={2}
            className="min-h-16 flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <Button
            variant="outline"
            disabled={generating || !adjustment.trim()}
            onClick={async () => {
              await onAdjust(adjustment.trim());
            }}
          >
            按要求生成草稿
          </Button>
        </div>
      </div>

      {draftPlan && (
        <div className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">待确认草稿 v{draftPlan.version}</span>
                <span className="text-xs text-muted-foreground">{draftPlan.items.length} 项 · 约 {Math.round(draftPlan.plannedMinutes / 60)} 小时</span>
              </div>
              <h3 className="mt-2 font-bold">本周目标：{draftPlan.objective}</h3>
              <p className="mt-1 text-sm text-muted-foreground">生成依据：{draftPlan.rationale}</p>
              {draftPlan.adjustmentRequest && (
                <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">你的调整要求：{draftPlan.adjustmentRequest}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onDiscardDraft}>废弃草稿</Button>
              <Button onClick={onConfirmDraft}>确认并应用</Button>
            </div>
          </div>

          {draftPlan.constraints && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {draftPlan.constraints.weeklyHours && <span className="rounded-full bg-muted px-2.5 py-1">容量：{draftPlan.constraints.weeklyHours} 小时</span>}
              {(draftPlan.constraints.unavailableWeekdays ?? []).map((day) => <span key={`day-${day}`} className="rounded-full bg-muted px-2.5 py-1">周{["日", "一", "二", "三", "四", "五", "六"][day]}不安排</span>)}
              {(draftPlan.constraints.reduceSubjects ?? []).map((subject) => <span key={`reduce-${subject}`} className="rounded-full bg-muted px-2.5 py-1">减少：{subject}</span>)}
              {(draftPlan.constraints.increaseSubjects ?? []).map((subject) => <span key={`increase-${subject}`} className="rounded-full bg-muted px-2.5 py-1">加强：{subject}</span>)}
            </div>
          )}

          <div>
            <p className="text-sm font-medium">本周做到什么算完成</p>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {draftPlan.successCriteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}
            </ul>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">与当前计划相比</p>
              <span className={`text-xs ${draftPlan.impact.requiresConfirmation ? "text-amber-600" : "text-muted-foreground"}`}>
                {draftPlan.impact.requiresConfirmation ? "应用前需要确认影响" : "没有高风险调整"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <span>新增 {draftPlan.impact.added.length}</span>
              <span>移除 {draftPlan.impact.removed.length}</span>
              <span>改期 {draftPlan.impact.moved.length}</span>
              <span>改时长 {draftPlan.impact.durationChanged.length}</span>
              <span className={draftPlan.impact.minuteDelta > 0 ? "text-amber-600" : "text-muted-foreground"}>
                容量 {draftPlan.impact.minuteDelta >= 0 ? "+" : ""}{draftPlan.impact.minuteDelta} 分钟
              </span>
            </div>
            {(draftPlan.impact.removed.length > 0 || draftPlan.impact.moved.length > 0) && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">查看受影响任务</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {draftPlan.impact.removed.map((item, index) => <li key={`removed-${index}`}>移除：{item.title}</li>)}
                  {draftPlan.impact.moved.map((item, index) => <li key={`moved-${index}`}>改期：{item.title}（{item.fromDate?.slice(5)} → {item.toDate?.slice(5)}）</li>)}
                </ul>
              </details>
            )}
          </div>

          <details className="rounded-xl border border-border/50 bg-card/70 p-3">
            <summary className="cursor-pointer text-sm font-medium">预览 {draftPlan.items.length} 个任务（确认前不会写入正式任务）</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {draftPlan.items.map((task, index) => (
                <div key={`${task.date}-${task.title}-${index}`} className="rounded-lg bg-muted/50 p-2.5 text-sm">
                  <div className="font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{task.date.slice(5)} · {task.subject || "未分类"} · {task.duration || 0} 分钟</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {planVersions.length > 0 && (
        <details className="rounded-2xl border border-border/50 bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">本周计划版本（{planVersions.length}）</summary>
          <div className="mt-3 space-y-2">
            {planVersions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">V{version.version}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${version.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : version.status === "draft" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                      {version.status === "active" ? "当前使用" : version.status === "draft" ? "待确认" : version.status === "archived" ? "历史版本" : version.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{version.objective} · 约 {Math.round(version.plannedMinutes / 60)} 小时</p>
                  {version.adjustmentRequest && <p className="mt-1 text-xs">调整来源：{version.adjustmentRequest}</p>}
                </div>
                <time className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleDateString("zh-CN")}</time>
              </div>
            ))}
          </div>
        </details>
      )}

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
            const ds = toLocalDateString(dayDate);
            const dayTasks = tasksByDay[i];
            const dayCompleted = dayTasks.filter((t) => t.completed).length;
            const isToday = toLocalDateString(new Date()) === ds;

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
                        <input type="checkbox" checked={task.completed}
                          onClick={(e) => e.stopPropagation()} // 阻止 click 冒泡到行的 onEditTask（否则勾选会误打开编辑弹窗）
                          onChange={(e) => { e.stopPropagation(); onToggleComplete(task); }}
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
