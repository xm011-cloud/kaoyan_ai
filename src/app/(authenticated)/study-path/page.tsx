"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleLinks } from "@/components/ui/module-links";
import { AiWaiting } from "@/components/ai-waiting";
import { cn } from "@/lib/utils";
import { useAiTask } from "@/hooks/use-ai-task";
import { confirmDialog } from "@/stores/confirm-store";

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
  version: number;
  generatedBy: string;
  adjustmentRequest?: string | null;
  changeImpact?: {
    changedStage: { key: string; title: string };
    addedMilestones: Array<{ title: string; subject: string }>;
    preservedCompletedMilestones: number;
    downstreamStageCount: number;
    weeklyPlanNeedsReview: boolean;
    datesChanged: boolean;
    scheduleRisk: string;
    requiresConfirmation: boolean;
  } | null;
}

interface PathStage {
  id: string;
  key: string;
  title: string;
  order: number;
  objective: string;
  exitCriteria: string[];
  status: "pending" | "active" | "completed" | "skipped";
  startDate: string | null;
  endDate: string | null;
}

interface PathData {
  path: StudyPath | null;
  stages: PathStage[];
  milestones: Milestone[];
  stats: { totalMilestones: number; completedMilestones: number; overallProgress: number } | null;
  isDraft: boolean;
  activePathId: string | null;
  history?: Array<{
    id: string;
    version: number;
    status: string;
    title: string;
    adjustmentRequest: string | null;
    confirmedAt: string | null;
    createdAt: string;
    _count: { stages: number; milestones: number };
  }>;
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingPath, setUpdatingPath] = useState(false);
  const [advancingStageId, setAdvancingStageId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [weeklyRedirect, setWeeklyRedirect] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [draftObjective, setDraftObjective] = useState("");
  const [draftExitCriteria, setDraftExitCriteria] = useState("");
  const [savingStageDraft, setSavingStageDraft] = useState(false);
  const autoAdjustmentRef = useRef(false);
  const { phase: waitPhase, estimate: waitEstimate, start: waitStart, stop: waitStop, cancel: waitCancel } = useAiTask();

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
    const controller = waitStart();
    try {
      const res = await fetch("/api/study-path", { method: "POST", signal: controller.signal });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setMessage(`已生成路线草稿（${d.stats.totalMilestones} 个里程碑），确认前不会替换当前路线`);
        if (d.milestones.length > 0) setExpandedPhase(d.milestones[0].phase);
      } else {
        setMessage(`❌ ${d.error || "生成失败"}`);
      }
    } catch (err: unknown) {
      // 用户主动取消：安静收场
      if ((err as { name?: string })?.name === "AbortError") return;
      setMessage("生成失败");
    } finally {
      waitStop();
      setGenerating(false);
    }
  };

  const handleDraftAction = async (action: "activate" | "discard") => {
    if (!data?.path) return;
    setUpdatingPath(true);
    setMessage("");
    try {
      const apply = async (confirmImpact = false) => {
        const res = await fetch("/api/study-path", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathId: data.path!.id, action, confirmImpact }),
        });
        return { res, next: await res.json() };
      };
      let result = await apply(false);
      if (result.res.status === 409 && result.next.requiresConfirmation) {
        const impact = result.next.impact as StudyPath["changeImpact"];
        const confirmed = await confirmDialog({
          title: "确认阶段调整？",
          message: `将为“${impact?.changedStage.title}”新增 ${impact?.addedMilestones.length ?? 0} 个里程碑，保留 ${impact?.preservedCompletedMilestones ?? 0} 个已完成里程碑。后续 ${impact?.downstreamStageCount ?? 0} 个阶段需要重新检查时间安排。`,
          confirmLabel: "确认启用新路线",
        });
        if (!confirmed) return;
        result = await apply(true);
      }
      if (!result.res.ok) throw new Error(result.next.error || "操作失败");
      const next = result.next;
      setData(next);
      setMessage(action === "activate" ? "✅ 新路线已确认，旧路线已保留为历史版本" : "已放弃路线草稿，当前路线没有变化");
      await loadPath();
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "操作失败"}`);
    } finally {
      setUpdatingPath(false);
    }
  };

  const handleAdjustStageWithRequest = async (request: string) => {
    if (!request.trim()) return;
    setAdjusting(true);
    setWeeklyRedirect(false);
    setMessage("");
    try {
      const res = await fetch("/api/study-path/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: request.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.scope === "weekly") setWeeklyRedirect(true);
        throw new Error(result.error || "生成阶段调整提案失败");
      }
      setData(result);
      setMessage("已生成阶段调整草稿，当前路线和本周任务尚未改变");
      const changedStage = result.path.changeImpact?.changedStage?.title;
      if (changedStage) setExpandedPhase(changedStage);
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "生成阶段调整提案失败"}`);
    } finally {
      setAdjusting(false);
    }
  };

  const handleAdjustStage = async () => {
    await handleAdjustStageWithRequest(adjustment);
  };

  // 周报中的“阶段调整”同样先产出路线草稿；用户确认前，当前路线和任务不会改变。
  useEffect(() => {
    const request = searchParams.get("adjustment")?.trim();
    if (searchParams.get("generateAdjustment") !== "1" || !request || autoAdjustmentRef.current) return;
    autoAdjustmentRef.current = true;
    setAdjustment(request);
    void handleAdjustStageWithRequest(request);
    router.replace(pathname, { scroll: false });
  // 此 effect 只处理一次 URL 明确触发的用户操作。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, pathname]);

  const handleCompleteStage = async (stage: PathStage, confirmIncomplete = false) => {
    setAdvancingStageId(stage.id);
    setMessage("");
    try {
      const res = await fetch(`/api/study-path/stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete }),
      });
      const result = await res.json();
      if (res.status === 409 && result.requiresConfirmation && !confirmIncomplete) {
        const confirmed = await confirmDialog({
          title: "仍有里程碑未完成",
          message: `${result.error}。仍然结束本阶段会保留这些记录，但后续计划将进入下一阶段。`,
          confirmLabel: "仍然进入下一阶段",
          cancelLabel: "继续当前阶段",
        });
        if (confirmed) await handleCompleteStage(stage, true);
        return;
      }
      if (!res.ok) throw new Error(result.error || "阶段推进失败");
      setMessage(result.pathCompleted ? "✅ 长期路线已完成" : `✅ 已进入下一阶段：${result.nextStage.title}`);
      await loadPath();
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "阶段推进失败"}`);
    } finally {
      setAdvancingStageId(null);
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

  const startStageEdit = (stage: PathStage) => {
    setEditingStageId(stage.id);
    setDraftObjective(stage.objective);
    setDraftExitCriteria((Array.isArray(stage.exitCriteria) ? stage.exitCriteria : []).join("\n"));
  };

  const saveStageDraft = async (stage: PathStage) => {
    setSavingStageDraft(true);
    setMessage("");
    try {
      const exitCriteria = draftExitCriteria.split("\n").map((item) => item.trim()).filter(Boolean);
      const res = await fetch("/api/study-path/stages/" + stage.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateDraft", objective: draftObjective, exitCriteria }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "保存阶段草稿失败");
      setEditingStageId(null);
      setMessage("✅ 已更新阶段目标和退出标准；确认整条路线前仍可继续调整。");
      await loadPath();
    } catch (err) {
      setMessage("❌ " + (err instanceof Error ? err.message : "保存阶段草稿失败"));
    } finally {
      setSavingStageDraft(false);
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
        <span className="text-muted-foreground">加载中...</span>
      </div>
    );
  }

  // Empty state
  if (!data?.path) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
          <div className="text-6xl">🗺️</div>
          <h1 className="text-2xl font-bold">AI 学习路径</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            基于你的目标、已确认学习情况和可投入时间，生成可共同编辑的分阶段学习路径，
            包含阶段目标、退出标准和里程碑。
          </p>
          <div className="bg-brand/10 rounded-xl p-4 text-sm text-brand max-w-md mx-auto text-left space-y-2">
            <p className="font-medium">📋 开始前可以先准备：</p>
            <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
              <li>至少保存一个学习方向；院校、日期和科目可后续确认</li>
              <li>在“考研方向”页描述当前基础与可投入时间</li>
              <li>无 AI Key 时也能生成本地路线草稿</li>
            </ul>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? "AI 生成中..." : "🤖 AI 生成学习路径"}
            </Button>
            {generating && <AiWaiting variant="inline" phase={waitPhase} estimate={waitEstimate} onCancel={waitCancel} />}
          </div>
          {message && <p className="text-sm">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="🗺️ 学习路径"
          subtitle={data.path.description}
          action={
            <div className="flex items-center gap-3">
              {generating && <AiWaiting variant="inline" phase={waitPhase} estimate={waitEstimate} onCancel={waitCancel} />}
              <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                {generating ? "生成中..." : data.isDraft ? "🔄 重新生成草稿" : "✨ 生成新版本"}
              </Button>
            </div>
          }
        />

        {message && (
          <div className="text-sm p-3 rounded-lg bg-brand/10 text-brand">
            {message}
            {weeklyRedirect && (
              <Link href="/tasks" className="ml-2 underline font-medium">去调整本周计划</Link>
            )}
          </div>
        )}

        {!data.isDraft && (
          <div id="stage-adjustment" className="scroll-mt-20 rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <div>
              <h2 className="font-semibold">当前阶段需要补充什么？</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                例如“计算机网络还没学，需要补基础”或“数学基础较弱”。临时的本周时间变化会自动引导到周计划。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                aria-label="描述阶段调整"
                value={adjustment}
                onChange={(event) => setAdjustment(event.target.value)}
                rows={2}
                placeholder="描述未学内容、长期薄弱点或阶段目标变化……"
                className="min-h-16 flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <Button variant="outline" onClick={handleAdjustStage} disabled={adjusting || !adjustment.trim()}>
                {adjusting ? "分析中..." : "生成阶段调整草稿"}
              </Button>
            </div>
          </div>
        )}

        {data.isDraft && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-3">
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">正在预览路线草稿 · V{data.path.version}</p>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/70 mt-1">
                草稿尚未生效，不能修改进度。确认后才会替换当前路线，旧路线仍作为历史版本保留。
              </p>
              {data.path.adjustmentRequest && (
                <p className="mt-2 rounded-lg bg-white/60 dark:bg-black/20 px-3 py-2 text-sm">
                  你的阶段调整要求：{data.path.adjustmentRequest}
                </p>
              )}
            </div>
            {data.path.changeImpact && (
              <div className="rounded-xl border border-amber-300/50 bg-white/60 dark:bg-black/20 p-3 space-y-2 text-sm">
                <p className="font-medium">调整影响</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span>调整阶段：{data.path.changeImpact.changedStage.title}</span>
                  <span>新增里程碑：{data.path.changeImpact.addedMilestones.length}</span>
                  <span>保留已完成成果：{data.path.changeImpact.preservedCompletedMilestones}</span>
                  <span>需复核后续阶段：{data.path.changeImpact.downstreamStageCount}</span>
                </div>
                <ul className="space-y-1 text-muted-foreground">
                  {data.path.changeImpact.addedMilestones.map((item) => (
                    <li key={`${item.subject}-${item.title}`}>新增：{item.subject} · {item.title}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  阶段日期暂不自动顺延；确认后应重新检查本周计划{data.path.changeImpact.weeklyPlanNeedsReview ? "，当前周计划也需要重新生成或确认" : ""}。
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleDraftAction("activate")} disabled={updatingPath}>确认并启用</Button>
              <Button variant="outline" onClick={() => handleDraftAction("discard")} disabled={updatingPath}>放弃草稿</Button>
            </div>
          </div>
        )}

        {(data.history?.length ?? 0) > 0 && (
          <details className="rounded-2xl border border-border/50 bg-card p-5">
            <summary className="cursor-pointer font-semibold">路线版本历史（{data.history?.length}）</summary>
            <div className="mt-4 space-y-2">
              {data.history?.map((version) => (
                <div key={version.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">V{version.version}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${version.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : version.status === "draft" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                        {version.status === "active" ? "当前使用" : version.status === "draft" ? "待确认" : version.status === "superseded" ? "历史版本" : version.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {version._count.stages} 个阶段 · {version._count.milestones} 个里程碑
                    </p>
                    {version.adjustmentRequest && <p className="mt-1 text-xs">调整来源：{version.adjustmentRequest}</p>}
                  </div>
                  <time className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleDateString("zh-CN")}</time>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Overall progress */}
        {stats && (
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">总体进度</span>
              <span className="text-sm text-muted-foreground">
                {stats.completedMilestones}/{stats.totalMilestones} 里程碑 · {Math.round(stats.overallProgress * 100)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${stats.overallProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase timeline */}
        <div className="space-y-4">
          {phases.map(([phase, milestones]) => {
            const formalStage = data.stages?.find((stage) => stage.title === phase);
            const cfg = PHASE_CONFIG[phase] || {
              color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", icon: "📌",
            };
            const completed = milestones.filter((m) => m.completedAt).length;
            const phaseProgress = milestones.length > 0
              ? milestones.reduce((s, m) => s + m.progress, 0) / milestones.length
              : 0;
            const isExpanded = expandedPhase === phase;

            return (
              <div key={phase} className={cn("rounded-2xl border bg-card overflow-hidden", cfg.border)}>
                {/* Phase header */}
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase)}
                  className={cn("w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-80 transition-opacity", cfg.bg)}
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn("font-bold", cfg.color)}>{phase}</h3>
                    <p className="text-xs text-muted-foreground">{formalStage?.objective || `${completed}/${milestones.length} 个里程碑完成`}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {completed}/{milestones.length} 完成 · {Math.round(phaseProgress * 100)}%
                      {formalStage?.status === "active" ? " · 当前阶段" : formalStage?.status === "completed" ? " · 已完成" : ""}
                    </p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-current rounded-full transition-all"
                      style={{ width: `${phaseProgress * 100}%`, color: cfg.color.replace("text-", "#") }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {/* Phase milestones */}
                {isExpanded && (
                  <div>
                    {formalStage && (
                      <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                        {data.isDraft && editingStageId === formalStage.id ? (
                          <div className="space-y-3">
                            <div>
                              <label htmlFor={"stage-objective-" + formalStage.id} className="text-xs font-medium">本阶段要达到什么</label>
                              <textarea
                                id={"stage-objective-" + formalStage.id}
                                value={draftObjective}
                                onChange={(event) => setDraftObjective(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            </div>
                            <div>
                              <label htmlFor={"stage-exit-" + formalStage.id} className="text-xs font-medium">做到什么算完成（每行一条）</label>
                              <textarea
                                id={"stage-exit-" + formalStage.id}
                                value={draftExitCriteria}
                                onChange={(event) => setDraftExitCriteria(event.target.value)}
                                rows={4}
                                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveStageDraft(formalStage)} disabled={savingStageDraft}>
                                {savingStageDraft ? "保存中..." : "保存本阶段方案"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingStageId(null)} disabled={savingStageDraft}>取消</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-medium mb-2">阶段退出标准</p>
                            <ul className="space-y-1">
                              {(Array.isArray(formalStage.exitCriteria) ? formalStage.exitCriteria : []).map((criterion) => (
                                <li key={criterion} className="text-xs text-muted-foreground flex gap-2">
                                  <span>○</span><span>{criterion}</span>
                                </li>
                              ))}
                            </ul>
                            {data.isDraft && (
                              <Button size="sm" variant="outline" className="mt-3" onClick={() => startStageEdit(formalStage)}>
                                共同编辑这一阶段
                              </Button>
                            )}
                          </>
                        )}
                        {formalStage.status === "active" && !data.isDraft && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => handleCompleteStage(formalStage)}
                            disabled={advancingStageId === formalStage.id}
                          >
                            {advancingStageId === formalStage.id ? "检查中..." : "完成本阶段并进入下一阶段"}
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="divide-y divide-border/50">
                    {milestones.map((m) => {
                      const isComplete = !!m.completedAt;
                      const subColor = SUBJECT_COLORS[m.subject] || "#6B7280";
                      return (
                        <div key={m.id} className={cn("px-5 py-3 flex items-start gap-3", isComplete && "opacity-60")}>
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleComplete(m)}
                            disabled={!!updatingId || data.isDraft}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                              isComplete
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-border/50 hover:border-success"
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
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {m.targetDate && (
                                <span className="text-xs text-muted-foreground">
                                  📅 {new Date(m.targetDate).toLocaleDateString("zh-CN")}
                                </span>
                              )}
                              {m.tips && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 truncate" title={m.tips}>
                                  💡 {m.tips}
                                </span>
                              )}
                              <Link
                                href={`/wrong-questions?subject=${encodeURIComponent(m.subject)}`}
                                className="text-xs text-brand hover:text-brand/80 shrink-0"
                              >
                                📕 {m.subject}错题
                              </Link>
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
                                  className="flex-1 h-1 accent-brand"
                                  disabled={!!updatingId || data.isDraft}
                                />
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                  {Math.round((m.progress || 0) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 模块联动 */}
        <ModuleLinks
          links={[
            { href: "/tasks", icon: "📋", label: "任务计划" },
            { href: "/wrong-questions", icon: "📕", label: "错题本" },
            { href: "/knowledge-graph", icon: "🧠", label: "知识图谱" },
          ]}
        />
      </div>
    </div>
  );
}
