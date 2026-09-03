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
import { getWeekStart, toLocalDateString } from "@/lib/date-utils";
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

interface WeeklyPlanDraft {
  id: string;
  version: number;
  status: string;
  objective: string;
  rationale: string;
  successCriteria: string[];
  plannedMinutes: number;
  items: Array<Omit<Task, "id" | "completed">>;
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

interface WeeklyPlanVersion {
  id: string;
  version: number;
  status: string;
  objective: string;
  plannedMinutes: number;
  adjustmentRequest?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
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
  const [weeklyPlanDraft, setWeeklyPlanDraft] = useState<WeeklyPlanDraft | null>(null);
  const [weeklyPlanVersions, setWeeklyPlanVersions] = useState<WeeklyPlanVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const autoAdjustmentRef = useRef(false);
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

  // ── Data loading ──
  const loadWeekTasks = useCallback(async () => {
    const ws = toLocalDateString(weekStart); // 本地周一日期串（与 generate-plan 存 weekStartDate 口径一致）
    try {
      const [taskRes, planRes] = await Promise.all([
        fetch(`/api/tasks?weekStart=${ws}`),
        fetch(`/api/weekly-plans?weekStart=${ws}`),
      ]);
      const [taskData, planData] = await Promise.all([taskRes.json(), planRes.json()]);
      setWeekTasks(taskData.tasks || []);
      setWeeklyPlanDraft(planData.draft || null);
      setWeeklyPlanVersions(planData.versions || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [weekStart, setWeekTasks, setWeeklyPlanDraft, setWeeklyPlanVersions]);

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
    router.replace(`${pathname}?week=${toLocalDateString(d)}`, { scroll: false });
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
          weekStartLocal: toLocalDateString(weekStart), // 本地周一（generate-plan 用它做任务日期清洗，避免 UTC 串错位）
          progress: editProgress,
          todayLocal: toLocalDateString(new Date()), // 本地今天（过滤本周已过去的日期）
          ...extraBody,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        await loadWeekTasks();
        toast.success("周计划草稿已生成，确认后才会替换本周未完成任务");
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

  const handleConfirmWeeklyPlan = async () => {
    if (!weeklyPlanDraft) return;
    const apply = async (confirmImpact: boolean) => {
      const res = await fetch("/api/weekly-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: weeklyPlanDraft.id, action: "activate", confirmImpact }),
      });
      return { res, data: await res.json().catch(() => ({})) };
    };
    let result = await apply(false);
    if (result.res.status === 409 && result.data.requiresConfirmation) {
      const impact = result.data.impact as WeeklyPlanDraft["impact"];
      const confirmed = await confirmDialog({
        title: "确认调整本周计划？",
        message: `这次调整会移除 ${impact.removed.length} 项、改期 ${impact.moved.length} 项，学习容量${impact.minuteDelta >= 0 ? "增加" : "减少"} ${Math.abs(impact.minuteDelta)} 分钟。已完成和手动任务不会受影响。`,
        confirmLabel: "确认调整",
        danger: impact.removed.length > 0,
      });
      if (!confirmed) return;
      result = await apply(true);
    }
    if (!result.res.ok) return toast.error(result.data.error || "确认周计划失败");
    setWeeklyPlanDraft(null);
    await loadWeekTasks();
    toast.success("周计划已确认，本周任务已更新");
  };

  const handleDiscardWeeklyPlan = async () => {
    if (!weeklyPlanDraft) return;
    const ok = await confirmDialog({
      title: "废弃这份周计划草稿？",
      message: "当前已生效的任务不会受到影响。",
      confirmLabel: "废弃草稿",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch("/api/weekly-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: weeklyPlanDraft.id, action: "archive" }),
    });
    if (!res.ok) return toast.error("废弃草稿失败");
    setWeeklyPlanDraft(null);
  };

  const handleGenerate = () => {
    // 探索期（无目标）→ 先描述需求、判断计划类型（0.4b）
    if (!goal) {
      setIntentOpen(true);
      return;
    }
    return runGenerate({});
  };

  const handleAdjustWeeklyPlan = async (request: string) => {
    await runGenerate({ adjustmentRequest: request });
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
    const week = searchParams.get("week") || toLocalDateString(getWeekStart(new Date()));
    router.replace(`${pathname}?week=${week}`, { scroll: false });
  }, [searchParams, pathname, router]);

  // 周报中的显式操作只生成周计划草稿；用户仍需在草稿中确认，才会更新正式任务。
  useEffect(() => {
    const request = searchParams.get("adjustment")?.trim();
    if (searchParams.get("generateAdjustment") !== "1" || !request || autoAdjustmentRef.current) return;
    autoAdjustmentRef.current = true;
    void handleAdjustWeeklyPlan(request);
    const week = searchParams.get("week") || toLocalDateString(getWeekStart(new Date()));
    router.replace(pathname + "?week=" + week, { scroll: false });
  // handleAdjustWeeklyPlan 依赖生成状态；此 effect 只应处理一次 URL 明确触发的操作。
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          weekStartLocal: toLocalDateString(weekStart),
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
    // 乐观更新 UI（失败时回滚，避免 UI 与 DB 分叉 → dashboard 不同步）
    setWeekTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    const rollback = () =>
      setWeekTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)));
    const init = (): RequestInit => ({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    // 离线 → 入队（联网后补传），保留乐观状态
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueWrite(`/api/tasks/${task.id}`, init(), { dedupeKey: `task:${task.id}` });
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, init());
      if (!res.ok) {
        // 服务器明确拒绝（4xx/5xx）→ 回滚乐观状态 + 提示；业务错重放也没用，不入队
        rollback();
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "任务状态更新失败，请重试");
      }
    } catch {
      // 网络错误 → 入队，联网补传（保留乐观状态，队列补传成功后两端一致）
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

        {/* 阶段摘要：这里只展示统一阶段建议；正式阶段目标与退出标准由长期路线维护。 */}
        <div className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-sm">{stage.label}</span>
              <span className="text-[10px] rounded-full bg-brand/10 px-2 py-0.5 text-brand font-medium">
                {stage.urgency === 0 ? "宽松" : stage.urgency === 1 ? "正常" : stage.urgency === 2 ? "紧迫" : "爆冲"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stage.hint}</p>
            <p className="text-xs mt-1.5">🎯 本阶段焦点：{stage.focus}</p>
            <p className="text-xs mt-1.5">📅 本周计划：{stage.planSpanHint}</p>
            {goal && (
              <button type="button" onClick={() => router.push("/study-path")} className="text-xs text-brand font-medium mt-2 hover:underline">
                查看长期路线、阶段目标和退出标准 →
              </button>
            )}
            {!goal && (
              <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                还没设考研目标——可以先生成一份自定义学习计划（点「生成本周计划」），或去「目标」页设置。
              </p>
            )}
        </div>

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
            draftPlan={weeklyPlanDraft}
            planVersions={weeklyPlanVersions}
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
            onConfirmDraft={handleConfirmWeeklyPlan} onDiscardDraft={handleDiscardWeeklyPlan}
            onAdjust={handleAdjustWeeklyPlan}
            initialAdjustment={searchParams.get("adjustment") || ""}
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
