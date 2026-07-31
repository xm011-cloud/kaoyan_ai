"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useGoal } from "@/hooks/use-goal";
import { WeeklyPlanner } from "./_components/weekly-planner";

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

interface ProgressEntry { percent: number; note: string }
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

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const ws = new Date(d.getTime() + diff * 86400000);
  ws.setHours(0, 0, 0, 0);
  return ws;
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
      setEditProgress((prev) => ({ ...savedProgress, ...prev }));
    }
  }, [savedProgress]);

  // ── Handlers ──
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);

  const handleWeekChange = (dir: -1 | 1) => {
    const d = new Date(weekStart.getTime() + dir * 7 * 86400000);
    setWeekStart(d);
    setLoading(true);
    setJudgeResult(null);
    router.replace(`${pathname}?week=${toDateString(d)}`, { scroll: false });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
        }),
      });
      if (res.ok) await loadWeekTasks();
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  const handleRegenerateDay = async (dateStr: string) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
          regenerateDay: dateStr,
        }),
      });
      if (res.ok) await loadWeekTasks();
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  const handleJudge = async () => {
    setJudging(true);
    try {
      const res = await fetch("/api/ai/judge-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: weekTasks, examDate, subjects }),
      });
      const data = await res.json();
      if (res.ok) setJudgeResult(data as JudgeResult);
    } catch { /* ignore */ } finally { setJudging(false); }
  };

  const handleRegenerateWithFeedback = async (feedback: string) => {
    setGenerating(true);
    try {
      await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartDate: weekStart.toISOString(),
          progress: editProgress,
          judgeFeedback: feedback,
        }),
      });
      await loadWeekTasks();
      setJudgeResult(null);
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      setWeekTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
    } catch { /* ignore */ }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("删除此任务？")) return;
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

  const handleSaveProgress = async () => {
    setSavingProgress(true);
    try {
      await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: editProgress }),
      });
    } catch { /* ignore */ } finally { setSavingProgress(false); }
  };

  // ── Render ──
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">学习计划</h1>
          <p className="text-gray-500 mt-1">
            距考试 {daysRemaining} 天 · {subjects.length} 个科目
          </p>
        </div>

        {/* Zone 1: Phase overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {phases.map((p) => (
            <div key={p.name} className={`p-4 rounded-xl border-2 ${p.isCurrent ? "ring-2 ring-blue-400 " + (PHASE_COLORS[p.name] || "border-gray-200") : "border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700"}`}>
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

        {/* Zone 2: Subject progress */}
        {subjects.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3">
            <h2 className="font-bold">📝 各科学习进度</h2>
            <p className="text-xs text-gray-500">填写当前进度，AI 生成计划时会根据你的实际水平调整</p>
            {subjects.map((subj) => {
              const ep = editProgress[subj] || { percent: 0, note: "" };
              const stats = systemStats[subj];
              return (
                <div key={subj} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{subj}</span>
                    <div className="flex items-center gap-3">
                      {stats && (
                        <div className="flex gap-3 text-[11px] text-gray-400">
                          {stats.knowledgeMastery !== null && <span title="知识图谱掌握度">🧠 {Math.round(stats.knowledgeMastery * 100)}%</span>}
                          {stats.wrongQuestions && <span title="错题">🔴 {stats.wrongQuestions.unreviewed}/{stats.wrongQuestions.total}</span>}
                          {stats.practiceScores && <span title="练习均分">📝 {stats.practiceScores.avg}%</span>}
                        </div>
                      )}
                      <input type="number" value={ep.percent || ""}
                        onChange={(e) => setEditProgress((prev) => ({ ...prev, [subj]: { ...prev[subj], percent: parseInt(e.target.value) || 0, note: prev[subj]?.note || "" } }))}
                        min={0} max={100} className="w-14 px-2 py-0.5 text-xs border rounded text-right dark:bg-gray-700 dark:border-gray-600" />
                      <span className="text-xs text-gray-400 w-6">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${ep.percent || 0}%` }} />
                    </div>
                    <input type="text" value={ep.note || ""}
                      onChange={(e) => setEditProgress((prev) => ({ ...prev, [subj]: { ...prev[subj], percent: prev[subj]?.percent || 0, note: e.target.value } }))}
                      placeholder="学到哪了..."
                      className="flex-1 px-2 py-0.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 max-w-[280px]" />
                  </div>
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
            daysRemaining={daysRemaining} onWeekChange={handleWeekChange}
            onGenerate={handleGenerate} onRegenerateDay={handleRegenerateDay}
            onToggleComplete={handleToggleComplete} onEditTask={openEdit}
            onDeleteTask={handleDeleteTask} onAddTask={handleAddTask}
            onJudge={handleJudge}
            onRegenerateWithFeedback={handleRegenerateWithFeedback}
            judgeResult={judgeResult} judging={judging}
          />
        </div>

        {/* Zone 4: All tasks history (collapsed by default) */}
        <details className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <summary className="font-bold cursor-pointer">📋 全部任务历史</summary>
          <div className="mt-3 text-sm text-gray-500">
            当前显示本周任务。点击上方 ◀ ▶ 按钮可以查看其他周的计划。
          </div>
        </details>

        {/* 相关模块 */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-3">相关模块</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/knowledge-graph" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🧠 知识图谱</Link>
            <Link href="/wrong-questions" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🔴 错题本</Link>
            <Link href="/study-path" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🗺️ 学习路径</Link>
          </div>
        </div>

        {/* Edit modal */}
        {editTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditTask(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">编辑任务</h3>
              <form onSubmit={saveEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">标题</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">描述</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                    className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">时长(分钟)</label>
                    <input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">日期</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">科目</label>
                    <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTask(null)}>取消</Button>
                  <Button type="submit" className="flex-1" disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add task modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-sm mx-4 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold">添加任务 — {addDate}</h3>
              <input type="text" value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
                placeholder="任务名称" className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              <div className="flex gap-2">
                <input type="number" value={addDuration} onChange={(e) => setAddDuration(e.target.value)}
                  placeholder="时长(分钟)" className="w-28 px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                <input type="text" value={addSubject} onChange={(e) => setAddSubject(e.target.value)}
                  placeholder="科目" className="flex-1 px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>取消</Button>
                <Button className="flex-1" onClick={saveAddTask}>添加</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
