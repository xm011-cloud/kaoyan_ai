"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  subject: string;
  order: number;
  targetDate: string | null;
  completedAt: string | null;
  progress: number;
  tips: string | null;
}

interface StudyPath {
  id: string;
  title: string;
  description: string | null;
  subjects: string[];
  status: string;
  generatedBy: string;
}

interface PathData {
  path: StudyPath | null;
  milestones: Milestone[];
  stats: { totalMilestones: number; completedMilestones: number; overallProgress: number } | null;
}

const PHASE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  "基础巩固": { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", icon: "🏗️" },
  "强化提升": { color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", icon: "📈" },
  "冲刺突破": { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", icon: "🚀" },
  "查漏补缺": { color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", icon: "🎯" },
};

const SUBJECT_COLORS: Record<string, string> = {
  "数学一": "#3B82F6", "数学二": "#3B82F6", "数学三": "#3B82F6",
  "英语一": "#10B981", "英语二": "#10B981",
  "政治": "#F59E0B",
  "408计算机": "#8B5CF6",
};

export default function StudyPathPage() {
  const [data, setData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPath = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/study-path");
      const d: PathData = await res.json();
      setData(d);
      // Auto-expand first active phase
      if (d.milestones.length > 0) {
        const firstActive = d.milestones.find((m) => !m.completedAt);
        if (firstActive) setExpandedPhase(firstActive.phase);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPath(); }, [loadPath]);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/study-path", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setMessage(`✅ 已生成 ${d.stats.totalMilestones} 个里程碑`);
        if (d.milestones.length > 0) setExpandedPhase(d.milestones[0].phase);
      } else {
        setMessage(`❌ ${d.error || "生成失败"}`);
      }
    } catch {
      setMessage("生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleComplete = async (m: Milestone) => {
    setUpdatingId(m.id);
    try {
      const completed = !m.completedAt;
      await fetch("/api/study-path/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneId: m.id,
          progress: completed ? 1.0 : m.progress,
          completed,
        }),
      });
      loadPath();
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateProgress = async (m: Milestone, progress: number) => {
    setUpdatingId(m.id);
    try {
      await fetch("/api/study-path/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: m.id, progress }),
      });
      loadPath();
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  // Group milestones by phase
  const phaseGroups = new Map<string, Milestone[]>();
  if (data?.milestones) {
    for (const m of data.milestones) {
      const group = phaseGroups.get(m.phase) || [];
      group.push(m);
      phaseGroups.set(m.phase, group);
    }
  }

  const phases = [...phaseGroups.entries()];
  const stats = data?.stats;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="text-gray-400">加载中...</span>
      </div>
    );
  }

  // Empty state
  if (!data?.path) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <div className="text-6xl">🗺️</div>
          <h1 className="text-2xl font-bold">AI 学习路径</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            基于你的目标院校、薄弱点和剩余时间，AI 自动生成分阶段学习路径，
            包含里程碑、时间线和学习建议。
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 max-w-md mx-auto text-left space-y-2">
            <p className="font-medium">📋 生成前请确认：</p>
            <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
              <li>已设置考研目标（院校、专业、科目）</li>
              <li>已添加错题（用于薄弱项分析）</li>
              <li>已配置 AI Key（可选，不配置则用本地模板）</li>
            </ul>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="lg">
            {generating ? "AI 生成中..." : "🤖 AI 生成学习路径"}
          </Button>
          {message && <p className="text-sm">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">🗺️ 学习路径</h1>
            <p className="text-sm text-gray-500 mt-1">{data.path.description}</p>
          </div>
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? "生成中..." : "🔄 重新生成"}
          </Button>
        </div>

        {message && (
          <div className="text-sm p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {message}
          </div>
        )}

        {/* Overall progress */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">总体进度</span>
              <span className="text-sm text-gray-500">
                {stats.completedMilestones}/{stats.totalMilestones} 里程碑 · {Math.round(stats.overallProgress * 100)}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${stats.overallProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase timeline */}
        <div className="space-y-4">
          {phases.map(([phase, milestones]) => {
            const cfg = PHASE_CONFIG[phase] || {
              color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", icon: "📌",
            };
            const completed = milestones.filter((m) => m.completedAt).length;
            const phaseProgress = milestones.length > 0
              ? milestones.reduce((s, m) => s + m.progress, 0) / milestones.length
              : 0;
            const isExpanded = expandedPhase === phase;

            return (
              <div key={phase} className={cn("rounded-xl border bg-white dark:bg-gray-800 overflow-hidden", cfg.border)}>
                {/* Phase header */}
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase)}
                  className={cn("w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-80 transition-opacity", cfg.bg)}
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn("font-bold", cfg.color)}>{phase}</h3>
                    <p className="text-xs text-gray-500">
                      {completed}/{milestones.length} 完成 · {Math.round(phaseProgress * 100)}%
                    </p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-current rounded-full transition-all"
                      style={{ width: `${phaseProgress * 100}%`, color: cfg.color.replace("text-", "#") }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {/* Phase milestones */}
                {isExpanded && (
                  <div className="divide-y dark:divide-gray-700">
                    {milestones.map((m) => {
                      const isComplete = !!m.completedAt;
                      const subColor = SUBJECT_COLORS[m.subject] || "#6B7280";
                      return (
                        <div key={m.id} className={cn("px-5 py-3 flex items-start gap-3", isComplete && "opacity-60")}>
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleComplete(m)}
                            disabled={!!updatingId}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                              isComplete
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-gray-300 dark:border-gray-600 hover:border-green-400"
                            )}
                            style={{ borderColor: !isComplete ? subColor + "60" : undefined }}
                          >
                            {isComplete && <span className="text-xs">✓</span>}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: subColor + "20", color: subColor }}
                              >
                                {m.subject}
                              </span>
                              <span className={cn("text-sm font-medium", isComplete && "line-through")}>
                                {m.title}
                              </span>
                            </div>
                            {m.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{m.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {m.targetDate && (
                                <span className="text-xs text-gray-400">
                                  📅 {new Date(m.targetDate).toLocaleDateString("zh-CN")}
                                </span>
                              )}
                              {m.tips && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 truncate" title={m.tips}>
                                  💡 {m.tips}
                                </span>
                              )}
                            </div>
                            {/* Progress slider */}
                            {!isComplete && (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.25"
                                  value={m.progress}
                                  onChange={(e) => handleUpdateProgress(m, parseFloat(e.target.value))}
                                  className="flex-1 h-1 accent-blue-500"
                                  disabled={!!updatingId}
                                />
                                <span className="text-xs text-gray-400 w-8 text-right">
                                  {Math.round((m.progress || 0) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 相关模块 */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-3">相关模块</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">📋 任务计划</Link>
            <Link href="/wrong-questions" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🔴 错题本</Link>
            <Link href="/knowledge-graph" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🧠 知识图谱</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
