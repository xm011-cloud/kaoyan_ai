"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/stores/confirm-store";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal";
import { ModuleLinks } from "@/components/ui/module-links";
import { useGoal } from "@/hooks/use-goal";
import { useAiTask } from "@/hooks/use-ai-task";
import { WeeklyPlanner } from "./_components/weekly-planner";
import { getWeekStart, toDateString, startOfDay } from "@/lib/date-utils";
import { enqueueWrite } from "@/lib/offline-queue";
import { toast } from "@/stores/toast-store";
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_TO_PERCENT,
  inferStageFromPercent, needsConfirmation, isStageConfirmed,
  getSubjectGuide,
  type SubjectProgress, type SubjectStage,
} from "@/lib/completion";
import { derivePrepStage } from "@/lib/prep-stage";
import { SubjectProbeModal, type ProbeResult } from "./_components/subject-probe";
import { PlanIntentModal } from "./_components/plan-intent-modal";
import type { PlanIntent } from "@/app/api/ai/judge-plan-intent/route";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  duration?: number | null;
  phase?: string | null;
  subject?: string | null;
  completed: boolean;
  weekStartDate?: string | null;
  source?: string | null;
}

type ProgressEntry = SubjectProgress;
interface SystemStats {
  knowledgeMastery: number | null;
  wrongQuestions: { total: number; reviewed: number; unreviewed: number; dueToday: number } | null;
  practiceScores: { avg: number; sessions: number } | null;
}

interface JudgeResult {
  score: number; strengths: string[];
  issues: { severity: string; description: string; fix: string }[];
  verdict: string; summary: string;
}

const PHASE_COLORS: Record<string, string> = {
  "基础阶段": "border-blue-300 bg-blue-50 dark:bg-blue-900/20",
  "强化阶段": "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
  "冲刺阶段": "border-red-300 bg-red-50 dark:bg-red-900/20",
};

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── State ──
  const { data: goal } = useGoal();
  const subjects = goal?.subjects ?? [];
  const examDate = goal?.examDate ? new Date(goal.examDate).toISOString() : "";
  const savedProgress = (goal?.progress as Record<string, ProgressEntry>) || {};
  const weeklyHours = (goal?.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null;

  // 阶段推导（0.3）：探索/基础/备考/冲刺
  const stage = useMemo(
    () =>
      derivePrepStage({
        examDate: goal?.examDate ?? null,
        hasGoal: !!goal,
        subjects,
        subjectProgress: savedProgress,
        weeklyHours,
      }),
    [goal, subjects, savedProgress, weeklyHours]
  );

  // 掌握度确认弹窗 + 探索期意图确认弹窗
  const [probeSubject, setProbeSubject] = useState<{ subject: string; stage: SubjectStage } | null>(null);
  const [intentOpen, setIntentOpen] = useState(false);

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const urlWeek = searchParams.get("week");
    if (urlWeek) {
      const d = new Date(urlWeek);
      if (!isNaN(d.getTime())) return getWeekStart(d);
    }
    return getWeekStart(new Date());
  });
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { phase: genPhase, estimate: genEstimate, start: genStart, stop: genStop, cancel: genCancel } = useAiTask();
  const { phase: judgePhase, estimate: judgeEstimate, start: judgeStart, stop: judgeStop, cancel: judgeCancel } = useAiTask();

  // Progress editing
  const [editProgress, setEditProgress] = useState<Record<string, ProgressEntry>>({...savedProgress});
  const [savingProgress, setSavingProgress] = useState(false);

  // Judge
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [judging, setJudging] = useState(false);

  // System stats for reference
  const [systemStats, setSystemStats] = useState<Record<string, SystemStats>>({});

  // Edit modal
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editPhase, setEditPhase] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Add task modal
  const [addDate, setAddDate] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addDuration, setAddDuration] = useState("");
  const [addSubject, setAddSubject] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // ── Computed ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysRemaining = examDate
    ? Math.max(1, Math.ceil((new Date(examDate).getTime() - today.getTime()) / 86400000))
    : 365;
  const sprintMode = daysRemaining < 30;

  const phases = useMemo(() => {
    const totalDays = daysRemaining;
    const phaseDefs = [
      { name: "基础阶段", ratio: 0.4, goal: "系统学习教材，完成课后习题，打牢基础" },
      { name: "强化阶段", ratio: 0.35, goal: "专题突破，真题训练，提升解题能力" },
      { name: "冲刺阶段", ratio: 0.25, goal: "模拟冲刺，查漏补缺，调整状态" },
    ];
    let start = new Date(today);
    const now = new Date();
    return phaseDefs.map((p) => {
      const days = Math.ceil(totalDays * p.ratio);
      const end = new Date(start.getTime() + days * 86400000);
      const r = { name: p.name, start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0], goal: p.goal, isCurrent: now >= start && now < end };
      start = new Date(end.getTime() + 86400000);
      return r;
    });
  }, [daysRemaining]);

  // ── Data loading ──
  const loadWeekTasks = useCallback(async () => {
    const ws = weekStart.toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/tasks?weekStart=${ws}`);
      const data = await res.json();
      setWeekTasks(data.tasks || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { loadWeekTasks(); }, [loadWeekTasks]);

  // Load system stats
  useEffect(() => {
    fetch("/api/progress/summary")
      .then((r) => r.json())
      .then((d) => setSystemStats(d.bySubject || {}))
      .catch(() => {});
  }, []);

  // Sync progress from goal
  useEffect(() => {
    if (savedProgress && Object.keys(savedProgress).length > 0) {
      setEditProgress((prev) => {
        const merged: Record<string, ProgressEntry> = { ...savedProgress, ...prev };
        // 老数据（无档位）→ 按 percent 推断档位，读时推断、保存时落库（不做静默迁移）
        for (const k of Object.keys(merged)) {
          const p = merged[k];
          if (p && !p.stage) {
            merged[k] = { ...p, stage: inferStageFromPercent(p.percent) };
          }
        }
        return merged;
      });
    }
  }, [savedProgress]);

  // ── Handlers ──
  const handleWeekChange = (dir: -1 | 1) => {
    const d = new Date(weekStart.getTime() + dir * 7 * 86400000);
    setWeekStart(d);
    setLoading(true);
    setJudgeResult(null);
    router.replace(`${pathname}?week=${toDateString(d)}`, { scroll: false });
  };

  const runGenerate = async (extraBody: Record<string, unknown>) => {
    setGenerating(true);
    const controller = genStart();
    try {
      const res = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
          todayLocal: toDateString(startOfDay(new Date())), // 本地今天（过滤本周已过去的日期）
          ...extraBody,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        await loadWeekTasks();
      } else {
        // 失败不静默：把后端错误提示给用户
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "生成计划失败，请稍后再试");
      }
    } catch {
      // 用户取消（AbortError）安静收场；其他网络错误给提示
      if (!controller.signal.aborted) toast.error("生成计划失败，请检查网络后重试");
    } finally {
      genStop();
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    // 探索期（无目标）→ 先描述需求、判断计划类型（0.4b）
    if (!goal) {
      setIntentOpen(true);
      return;
    }
    return runGenerate({});
  };

  const handleIntentConfirm = async (intent: PlanIntent) => {
    setIntentOpen(false);
    await runGenerate({ planContext: { label: intent.summary, subjects: intent.subjects } });
  };

  // ── ?generate=1 自动生成（周计划到期提醒跳转而来）──
  const autoGeneratedRef = useRef(false);
  const generateRef = useRef(handleGenerate);
  generateRef.current = handleGenerate;

  useEffect(() => {
    if (searchParams.get("generate") !== "1" || autoGeneratedRef.current) return;
    autoGeneratedRef.current = true;
    generateRef.current();
    const week = searchParams.get("week") || toDateString(getWeekStart(new Date()));
    router.replace(`${pathname}?week=${week}`, { scroll: false });
  }, [searchParams, pathname, router]);

  const handleRegenerateDay = async (dateStr: string) => {
    setGenerating(true);
    const controller = genStart();
    try {
      const res = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
          regenerateDay: dateStr,
        }),
        signal: controller.signal,
      });
      if (res.ok) await loadWeekTasks();
    } catch { /* ignore：含用户取消 */ } finally { genStop(); setGenerating(false); }
  };

  const handleJudge = async () => {
    setJudging(true);
    const controller = judgeStart();
    try {
      const res = await fetch("/api/ai/judge-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: weekTasks, examDate, subjects }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) setJudgeResult(data as JudgeResult);
    } catch { /* ignore：含用户取消 */ } finally { judgeStop(); setJudging(false); }
  };

  const handleRegenerateWithFeedback = async (feedback: string) => {
    setGenerating(true);
    const controller = genStart();
    try {
      await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
          judgeFeedback: feedback,
        }),
        signal: controller.signal,
      });
      await loadWeekTasks();
      setJudgeResult(null);
    } catch { /* ignore：含用户取消 */ } finally { genStop(); setGenerating(false); }
  };

  const handleToggleComplete = async (task: Task) => {
    const next = !task.completed;
    // 乐观更新 UI（原实现等请求完成才更新；改为立即更新，离线入队也不会让勾选丢失）
    setWeekTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    const init = (): RequestInit => ({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    // 离线 → 入队（dedupeKey 归并同一任务最新状态）
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueWrite(`/api/tasks/${task.id}`, init(), { dedupeKey: `task:${task.id}` });
      return;
    }
    try {
      await fetch(`/api/tasks/${task.id}`, init());
    } catch {
      await enqueueWrite(`/api/tasks/${task.id}`, init(), { dedupeKey: `task:${task.id}` });
    }
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirmDialog({
      title: "删除任务",
      message: "删除此任务？",
      confirmLabel: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setWeekTasks((prev) => prev.filter((t) => t.id !== id));
    } catch { /* ignore */ }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
    setEditDuration(task.duration?.toString() || "");
    setEditSubject(task.subject || "");
    setEditPhase(task.phase || "");
    setEditDate(task.date.split("T")[0]);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask || !editTitle.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/tasks/${editTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle, description: editDesc || null,
          duration: editDuration ? parseInt(editDuration) : null,
          subject: editSubject || null, phase: editPhase || null, date: editDate,
        }),
      });
      setEditTask(null);
      await loadWeekTasks();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleAddTask = (dateStr: string) => {
    setAddDate(dateStr);
    setAddTitle("");
    setAddDuration("");
    setAddSubject(subjects[0] || "");
    setShowAdd(true);
  };

  const saveAddTask = async () => {
    if (!addTitle.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle, date: addDate,
          duration: addDuration ? parseInt(addDuration) : null,
          subject: addSubject || null,
          weekStartDate: weekStart.toISOString(), source: "manual",
        }),
      });
      setShowAdd(false);
      await loadWeekTasks();
    } catch { /* ignore */ }
  };

  const saveProgress = async (next: Record<string, ProgressEntry>) => {
    setSavingProgress(true);
    try {
      await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: next }),
      });
    } catch { /* ignore */ } finally { setSavingProgress(false); }
  };

  const handleSaveProgress = () => saveProgress(editProgress);

  /** 采纳对话校准结果 → 校准档位 + 置信度 high + 立即保存 */
  const handleProbeAccept = (subj: string, r: ProbeResult) => {
    const next: Record<string, ProgressEntry> = {
      ...editProgress,
      [subj]: {
        ...(editProgress[subj] || {}),
        calibratedStage: r.calibratedStage,
        confidence: "high" as const,
        lastProbeAt: new Date().toISOString(),
      },
    };
    setEditProgress(next);
    saveProgress(next);
    setProbeSubject(null);
  };

  /** 保持自评 → 只关弹窗，不改置信度（仍显示待确认） */
  const handleProbeKeep = () => setProbeSubject(null);

  /** 自评档位变化 → 更新档位 + 默认 percent；旧校准失效回到"待确认"（保守原则） */
  const setSubjectStage = (subj: string, stage: SubjectStage) => {
    setEditProgress((prev) => {
      const existing = prev[subj] || {};
      return {
        ...prev,
        [subj]: {
          ...existing,
          stage,
          percent: STAGE_TO_PERCENT[stage],
          confidence: "low",
          calibratedStage: undefined,
        },
      };
    });
  };

  // ── Render ──
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="备考计划"
          subtitle={stage.hint}
        />

        {/* 冲刺模式横幅 */}
        {sprintMode && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-gradient-to-r from-red-50 dark:from-red-900/20 to-transparent px-4 py-3">
            <span className="text-xl leading-none">🔥</span>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                距考试仅 {daysRemaining} 天，已进入冲刺模式
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                计划将聚焦真题计时作答、错题当日复盘与高频考点背诵
              </p>
            </div>
          </div>
        )}

        {/* Zone 1: 阶段总览（备考期显示三阶段卡；探索/基础/冲刺显示阶段卡） */}
        {stage.id === "prep" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {phases.map((p) => (
              <div key={p.name} className={`p-4 rounded-xl border-2 ${p.isCurrent ? "ring-2 ring-blue-400 " + (PHASE_COLORS[p.name] || "border-border/50") : "border-border/50 bg-card"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{p.name}</span>
                  {p.isCurrent && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">当前</span>}
                </div>
                <p className="text-xs text-gray-500 mb-2">{p.goal}</p>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>{p.start}</span>
                  <span>→</span>
                  <span>{p.end}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-sm">{stage.label}</span>
              <span className="text-[10px] rounded-full bg-brand/10 px-2 py-0.5 text-brand font-medium">
                {stage.urgency === 0 ? "宽松" : stage.urgency === 1 ? "正常" : stage.urgency === 2 ? "紧迫" : "爆冲"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stage.hint}</p>
            <p className="text-xs mt-1.5">🎯 本阶段焦点：{stage.focus}</p>
            {!goal && (
              <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                还没设考研目标——可以先生成一份自定义学习计划（点「生成本周计划」），或去「目标」页设置。
              </p>
            )}
          </div>
        )}

        {/* Zone 2: Subject progress */}
        {subjects.length > 0 && (
          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
            <h2 className="font-bold">📝 各科学习进度</h2>
            <p className="text-xs text-gray-500">点选各科学习档位（自评），AI 生成计划时会根据你的实际水平调整。升到「学习中」以上会标 ⚪待确认——系统对你的自评持保守态度，计划生成前可对话确认掌握度</p>
            {subjects.map((subj) => {
              const ep = editProgress[subj] || { percent: 0, note: "" };
              const stats = systemStats[subj];
              return (
                <div key={subj} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{subj}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {stats && (
                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
                          {stats.knowledgeMastery !== null && <span title="知识图谱掌握度">🧠 {Math.round(stats.knowledgeMastery * 100)}%</span>}
                          {stats.wrongQuestions && <span title="错题">🔴 {stats.wrongQuestions.unreviewed}/{stats.wrongQuestions.total}</span>}
                          {stats.practiceScores && <span title="练习均分">📝 {stats.practiceScores.avg}%</span>}
                        </div>
                      )}
                      <input type="number" value={ep.percent || ""}
                        onChange={(e) => setEditProgress((prev) => ({ ...prev, [subj]: { ...prev[subj], percent: parseInt(e.target.value) || 0, note: prev[subj]?.note || "" } }))}
                        min={0} max={100} className="w-16 min-w-0 px-2 py-0.5 text-xs border border-border/50 rounded text-right bg-muted/50" />
                      <span className="text-xs text-gray-400 w-6">%</span>
                    </div>
                  </div>

                  {/* 档位选择（自评 = 假设，非事实；升档会标"待确认"） */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {STAGE_ORDER.map((st) => {
                      const active = (ep.stage ?? inferStageFromPercent(ep.percent)) === st;
                      return (
                        <button
                          key={st} type="button"
                          onClick={() => setSubjectStage(subj, st)}
                          className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                            active
                              ? "bg-brand/10 border-brand/40 text-brand font-medium"
                              : "border-border/50 text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          {STAGE_LABELS[st]}
                        </button>
                      );
                    })}
                    {needsConfirmation(ep) && (
                      <span className="text-[10px] text-warning" title="系统对你的自评持保守态度，计划生成前可对话确认掌握度">
                        ⚪ 待确认
                      </span>
                    )}
                    {isStageConfirmed(ep) && (
                      <span className="text-[10px] text-success">✅ 已确认</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setProbeSubject({ subject: subj, stage: ep.stage ?? inferStageFromPercent(ep.percent) })}
                      className="px-2 py-1 rounded-full text-[11px] border border-dashed border-border/60 text-muted-foreground hover:bg-muted/60 transition-colors"
                      title="用 2-3 个对话式问题确认你的掌握度（不判分、不打脸）"
                    >
                      🤔 确认掌握度
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${ep.percent || 0}%` }} />
                    </div>
                    <input type="text" value={ep.note || ""}
                      onChange={(e) => setEditProgress((prev) => ({ ...prev, [subj]: { ...prev[subj], percent: prev[subj]?.percent || 0, note: e.target.value } }))}
                      placeholder="学到哪了..."
                      className="flex-1 px-2 py-0.5 text-xs border border-border/50 rounded bg-muted/50 max-w-[280px]" />
                  </div>

                  {/* 科目感知完成标准 */}
                  <p className="text-[10px] text-muted-foreground/80">{getSubjectGuide(subj)}</p>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={handleSaveProgress} disabled={savingProgress}>
              {savingProgress ? "保存中..." : "💾 保存进度"}
            </Button>
          </div>
        )}

        {/* Zone 3: Weekly planner */}
        <div>
          <h2 className="font-bold mb-3">📅 本周计划</h2>
          <WeeklyPlanner
            weekStart={weekStart} weekTasks={weekTasks} loading={loading}
            generating={generating} subjects={subjects} examDate={examDate}
            daysRemaining={daysRemaining} sprintMode={sprintMode} onWeekChange={handleWeekChange}
            onGenerate={handleGenerate} onRegenerateDay={handleRegenerateDay}
            onToggleComplete={handleToggleComplete} onEditTask={openEdit}
            onDeleteTask={handleDeleteTask} onAddTask={handleAddTask}
            onJudge={handleJudge}
            onRegenerateWithFeedback={handleRegenerateWithFeedback}
            judgeResult={judgeResult} judging={judging}
            generatingPhase={genPhase} generatingEstimate={genEstimate} onCancelGenerate={genCancel}
            judgingPhase={judgePhase} judgingEstimate={judgeEstimate} onCancelJudge={judgeCancel}
          />
        </div>

        {/* 模块联动 */}
        <ModuleLinks
          links={[
            { href: "/knowledge-graph", icon: "🧠", label: "知识图谱" },
            { href: "/wrong-questions", icon: "📕", label: "错题本" },
            { href: "/study-path", icon: "🗺️", label: "学习路径" },
          ]}
        />

        {/* Edit modal */}
        {editTask && (
          <Modal
            open
            onClose={() => setEditTask(null)}
            title="编辑任务"
            footer={
              <>
                <Button type="button" variant="outline" onClick={() => setEditTask(null)}>取消</Button>
                <Button type="submit" form="task-edit-form" disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
              </>
            }
          >
            <form id="task-edit-form" onSubmit={saveEdit} className="space-y-3">
                <div>
                  <label htmlFor="task-edit-title" className="block text-xs font-medium mb-1">标题</label>
                  <input id="task-edit-title" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" required />
                </div>
                <div>
                  <label htmlFor="task-edit-desc" className="block text-xs font-medium mb-1">描述</label>
                  <textarea id="task-edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                    className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="task-edit-duration" className="block text-xs font-medium mb-1">时长(分钟)</label>
                    <input id="task-edit-duration" type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <div>
                    <label htmlFor="task-edit-date" className="block text-xs font-medium mb-1">日期</label>
                    <input id="task-edit-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <div>
                    <label htmlFor="task-edit-subject" className="block text-xs font-medium mb-1">科目</label>
                    <input id="task-edit-subject" type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                </div>
              </form>
          </Modal>
        )}

        {/* Add task modal */}
        {showAdd && (
          <Modal
            open
            onClose={() => setShowAdd(false)}
            title={`添加任务 — ${addDate}`}
            size="sm"
            footer={
              <>
                <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
                <Button onClick={saveAddTask}>添加</Button>
              </>
            }
          >
            <div className="space-y-3">
              <input type="text" value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
                placeholder="任务名称" className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              <div className="flex gap-2">
                <input type="number" value={addDuration} onChange={(e) => setAddDuration(e.target.value)}
                  placeholder="时长(分钟)" className="w-28 h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <input type="text" value={addSubject} onChange={(e) => setAddSubject(e.target.value)}
                  placeholder="科目" className="flex-1 h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
            </div>
          </Modal>
        )}

        {/* 掌握度确认弹窗（对话校准 0.2） */}
        {probeSubject && (
          <SubjectProbeModal
            open
            onClose={() => setProbeSubject(null)}
            subject={probeSubject.subject}
            stage={probeSubject.stage}
            onAccept={(r) => handleProbeAccept(probeSubject.subject, r)}
            onKeep={handleProbeKeep}
          />
        )}

        {/* 探索期计划意图确认（0.4b） */}
        <PlanIntentModal open={intentOpen} onClose={() => setIntentOpen(false)} onConfirm={handleIntentConfirm} />
      </div>
    </div>
  );
}
