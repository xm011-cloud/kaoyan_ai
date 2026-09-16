"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleLinks } from "@/components/ui/module-links";
import { AiWaiting } from "@/components/ai-waiting";
import { cn } from "@/lib/utils";
import { useAiTask } from "@/hooks/use-ai-task";
import { confirmDialog } from "@/stores/confirm-store";

interface Milestone {
  id: string;
  stageId: string | null;
  title: string;
  description: string | null;
  phase: string;
  subject: string;
  order: number;
  targetDate: string | null;
  completedAt: string | null;
  progress: number;
  reviewedAt?: string | null;
  reviewOutcome?: "achieved" | "continue" | "relearn" | null;
  reviewNote?: string | null;
  tips: string | null;
}

interface MilestoneEvidence {
  tasks: { total: number; completed: number; plannedMinutes: number; completedMinutes: number };
  learning: { sessions: number; minutes: number; clear: number; needsPractice: number; blocked: number };
  practice: { completed: number; scored: number; averageRate: number | null };
  wrongQuestions: { reviewed: number };
  items: Array<{
    id: string;
    kind: string;
    kindLabel: string;
    title: string;
    occurredAt: string;
    durationMinutes: number | null;
    score: number | null;
    maxScore: number | null;
    href: string | null;
  }>;
  reviewReady: boolean;
  prompt: string;
}

interface ReviewFollowUp {
  label: string;
  href: string;
}

interface UnlinkedEvidence {
  id: string;
  taskId: string | null;
  kind: "task_completion" | "course_session" | "practice_session" | "wrong_review";
  title: string;
  subject: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  score: number | null;
  maxScore: number | null;
}

const EVIDENCE_KIND_LABELS: Record<UnlinkedEvidence["kind"], string> = {
  task_completion: "任务完成",
  course_session: "课程学习",
  practice_session: "练习",
  wrong_review: "错题复习",
};

function nextMondayLocal(): string {
  const next = new Date();
  const days = next.getDay() === 0 ? 1 : 8 - next.getDay();
  next.setDate(next.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
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
    preservedReviewedMilestones?: number;
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
  const [needsIntake, setNeedsIntake] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [draftObjective, setDraftObjective] = useState("");
  const [draftExitCriteria, setDraftExitCriteria] = useState("");
  const [savingStageDraft, setSavingStageDraft] = useState(false);
  const [evidenceByMilestone, setEvidenceByMilestone] = useState<Record<string, MilestoneEvidence>>({});
  const [unlinkedEvidence, setUnlinkedEvidence] = useState<UnlinkedEvidence[]>([]);
  const [evidenceAssignments, setEvidenceAssignments] = useState<Record<string, string>>({});
  const [unlinkedEvidenceLoading, setUnlinkedEvidenceLoading] = useState(false);
  const [unlinkedEvidenceError, setUnlinkedEvidenceError] = useState("");
  const [assigningEvidenceId, setAssigningEvidenceId] = useState<string | null>(null);
  const [reviewingMilestone, setReviewingMilestone] = useState<Milestone | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewFollowUp, setReviewFollowUp] = useState<ReviewFollowUp | null>(null);
  const autoAdjustmentRef = useRef(false);
  const autoReviewRef = useRef<string | null>(null);
  const { phase: waitPhase, estimate: waitEstimate, start: waitStart, stop: waitStop, cancel: waitCancel } = useAiTask();

  const loadUnlinkedEvidence = useCallback(async () => {
    setUnlinkedEvidenceLoading(true);
    setUnlinkedEvidenceError("");
    try {
      const res = await fetch("/api/study-evidence?limit=20", { cache: "no-store" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "获取待归属学习记录失败");
      setUnlinkedEvidence(Array.isArray(result.evidence) ? result.evidence : []);
    } catch (err) {
      setUnlinkedEvidenceError(err instanceof Error ? err.message : "获取待归属学习记录失败");
    } finally {
      setUnlinkedEvidenceLoading(false);
    }
  }, []);

  const loadPath = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/study-path");
      const d: PathData = await res.json();
      setData(d);
      if (d.path?.status === "active") void loadUnlinkedEvidence();
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
  }, [loadUnlinkedEvidence]);

  useEffect(() => { loadPath(); }, [loadPath]);

  const assignEvidence = async (evidence: UnlinkedEvidence) => {
    const milestoneId = evidenceAssignments[evidence.id];
    if (!milestoneId) return;
    setAssigningEvidenceId(evidence.id);
    setMessage("");
    try {
      const res = await fetch("/api/study-evidence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId: evidence.id, milestoneId, taskId: evidence.taskId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "归属学习记录失败");
      const milestone = data?.milestones.find((item) => item.id === milestoneId);
      setUnlinkedEvidence((current) => current.filter((item) => item.id !== evidence.id));
      setEvidenceAssignments((current) => {
        const next = { ...current };
        delete next[evidence.id];
        return next;
      });
      setMessage(`✅ 已将“${evidence.title}”归属到“${milestone?.title || "所选里程碑"}”，路线证据已更新。`);
      if (evidenceByMilestone[milestoneId]) await loadEvidence(milestoneId);
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "归属学习记录失败"}`);
    } finally {
      setAssigningEvidenceId(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage("");
    setNeedsIntake(false);
    const controller = waitStart();
    try {
      const res = await fetch("/api/study-path", { method: "POST", signal: controller.signal });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setMessage(`已生成路线草稿（${d.stats.totalMilestones} 个里程碑），确认前不会替换当前路线`);
        if (d.milestones.length > 0) setExpandedPhase(d.milestones[0].phase);
      } else {
        setNeedsIntake(d.needsIntake === true);
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
          message: `将为“${impact?.changedStage.title}”新增 ${impact?.addedMilestones.length ?? 0} 个里程碑，保留 ${impact?.preservedCompletedMilestones ?? 0} 个已完成成果和 ${impact?.preservedReviewedMilestones ?? 0} 条复盘结论。后续 ${impact?.downstreamStageCount ?? 0} 个阶段需要重新检查时间安排。`,
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

  const loadEvidence = async (milestoneId: string) => {
    const res = await fetch(`/api/study-path/milestones/${milestoneId}/evidence`, { cache: "no-store" });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "获取学习证据失败");
    setEvidenceByMilestone((current) => ({ ...current, [milestoneId]: result.evidence }));
    return result.evidence as MilestoneEvidence;
  };

  const openReview = async (milestone: Milestone) => {
    setReviewFollowUp(null);
    setReviewingMilestone(milestone);
    setReviewNote(milestone.reviewNote || "");
    try { await loadEvidence(milestone.id); } catch (err) { setMessage(`❌ ${err instanceof Error ? err.message : "获取学习证据失败"}`); }
  };

  const submitReview = async (outcome: "achieved" | "continue" | "relearn") => {
    if (!reviewingMilestone) return;
    const milestone = reviewingMilestone;
    setUpdatingId(milestone.id);
    try {
      const res = await fetch(`/api/study-path/milestones/${milestone.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, note: reviewNote }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "保存复盘失败");
      setReviewingMilestone(null);
      await loadPath();

      const weekStart = nextMondayLocal();
      const adjustment = outcome === "achieved"
        ? `里程碑「${milestone.title}」已经由用户确认达成。保留全部历史证据，下周转向当前阶段的下一个未完成里程碑。`
        : outcome === "relearn"
          ? `用户复盘后确认「${milestone.title}」需要重学。下周只围绕这项基础补学、基础练习和复盘，不扩大到其他里程碑。`
          : `用户复盘后决定继续巩固「${milestone.title}」。下周安排针对性练习、错题复习和再次复盘，不扩大到其他里程碑。`;
      let draftError = "";
      try {
        const draftResponse = await fetch("/api/ai/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStartDate: `${weekStart}T00:00:00`,
            weekStartLocal: weekStart,
            todayLocal: weekStart,
            generationMode: "local",
            adjustmentRequest: adjustment,
            ...(outcome !== "achieved" ? { focusMilestoneId: milestone.id, reviewOutcome: outcome } : {}),
          }),
        });
        const draftResult = await draftResponse.json().catch(() => ({}));
        if (!draftResponse.ok) draftError = draftResult.error || "生成下周草稿失败";
      } catch {
        draftError = "网络暂时不可用";
      }
      if (draftError) {
        setMessage(`复盘结论已保存，但暂未生成下周草稿：${draftError}`);
        setReviewFollowUp({ label: "前往计划页手动调整", href: `/tasks?week=${weekStart}&adjustment=${encodeURIComponent(adjustment)}` });
      } else {
        setMessage(outcome === "achieved"
          ? "✅ 已确认里程碑达成，并生成转向下一里程碑的下周草稿；确认前不会改变正式任务。"
          : outcome === "relearn"
            ? "↺ 已保存“需要重学”，并生成仅针对该里程碑的下周草稿；确认前不会改变正式任务。"
            : "✓ 已保存“继续巩固”，并生成仅针对该里程碑的下周草稿；确认前不会改变正式任务。");
        setReviewFollowUp({ label: "查看并确认下周草稿", href: `/tasks?week=${weekStart}` });
      }
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "保存复盘失败"}`);
    } finally { setUpdatingId(null); }
  };

  // AI 工作区的“去复盘”操作卡带上里程碑 ID；进入路线页后直接打开对应复盘，
  // 仍由用户选择结论，不会因为跳转自动改动数据。
  useEffect(() => {
    const milestoneId = searchParams.get("review");
    const milestone = milestoneId ? data?.milestones.find((item) => item.id === milestoneId) : null;
    if (!milestone || autoReviewRef.current === milestoneId) return;
    autoReviewRef.current = milestoneId;
    void openReview(milestone);
  // openReview 每次渲染重建，但 ref 保证同一 URL 只触发一次。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, searchParams]);

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
  const activeStage = !data?.isDraft
    ? data?.stages.find((stage) => stage.status === "active") ?? null
    : null;

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
      <div className="workspace-page">
        <div className="mx-auto max-w-3xl space-y-4 py-16 text-center">
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
          {needsIntake && (
            <Link href="/goal#planning-intake" className="text-sm font-medium text-brand hover:underline">
              先和 AI 确认目标、基础与容量 →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="mx-auto max-w-4xl space-y-7">
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
            {reviewFollowUp && (
              <Link href={reviewFollowUp.href} className="ml-2 underline font-medium">{reviewFollowUp.label}</Link>
            )}
          </div>
        )}

        {activeStage && (
          <section className="rounded-2xl border border-brand/25 bg-brand/5 p-5" aria-labelledby="weekly-plan-handoff-title">
            <p id="weekly-plan-handoff-title" className="text-sm font-semibold">路线已确认，接下来安排本周</p>
            <p className="mt-1 text-sm text-muted-foreground">
              当前阶段是“{activeStage.title}”。周计划会围绕它的目标和里程碑生成，并且仍会先以草稿形式让你确认。
            </p>
            <Link href="/tasks" className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
              查看并安排本周
            </Link>
          </section>
        )}

        {data.path.status === "active" && (unlinkedEvidenceLoading || unlinkedEvidenceError || unlinkedEvidence.length > 0) && (
          <details className="rounded-2xl border border-border/50 bg-card p-5">
            <summary className="cursor-pointer font-semibold">
              待归属学习记录{unlinkedEvidence.length > 0 ? `（${unlinkedEvidence.length}）` : ""}
            </summary>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              这些学习已经被保存，但没有明确属于哪个路线目标，因此暂不计入任何里程碑。请确认后再归属，系统不会按科目或时间自动猜测。
            </div>
            {unlinkedEvidenceLoading && <p className="mt-4 text-sm text-muted-foreground">正在读取学习记录…</p>}
            {unlinkedEvidenceError && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{unlinkedEvidenceError}</span>
                <Button size="sm" variant="outline" onClick={loadUnlinkedEvidence}>重试</Button>
              </div>
            )}
            {!unlinkedEvidenceLoading && !unlinkedEvidenceError && (
              <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border/60">
                {unlinkedEvidence.map((evidence) => {
                  const candidates = data.milestones.filter((milestone) => (
                    !milestone.completedAt && (!evidence.subject || milestone.subject === evidence.subject)
                  ));
                  return (
                    <div
                      key={evidence.id}
                      data-testid={`unlinked-evidence-${evidence.id}`}
                      className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{evidence.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {EVIDENCE_KIND_LABELS[evidence.kind]} · {new Date(evidence.occurredAt).toLocaleDateString("zh-CN")}
                          {evidence.subject ? ` · ${evidence.subject}` : ""}
                          {evidence.durationMinutes ? ` · ${evidence.durationMinutes} 分钟` : ""}
                          {evidence.maxScore !== null ? ` · ${evidence.score ?? 0}/${evidence.maxScore} 分` : ""}
                        </p>
                      </div>
                      {candidates.length > 0 ? (
                        <select
                          aria-label={`为“${evidence.title}”选择里程碑`}
                          value={evidenceAssignments[evidence.id] || ""}
                          onChange={(event) => setEvidenceAssignments((current) => ({ ...current, [evidence.id]: event.target.value }))}
                          className="h-9 w-full rounded-lg border border-border/70 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                        >
                          <option value="">选择要推进的里程碑</option>
                          {candidates.map((milestone) => (
                            <option key={milestone.id} value={milestone.id}>{milestone.phase} · {milestone.title}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-muted-foreground">当前路线没有同科目的未完成里程碑</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!evidenceAssignments[evidence.id] || assigningEvidenceId === evidence.id || candidates.length === 0}
                        onClick={() => assignEvidence(evidence)}
                      >
                        {assigningEvidenceId === evidence.id ? "归属中…" : "确认归属"}
                      </Button>
                    </div>
                  );
                })}
                {unlinkedEvidence.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">当前没有待归属记录。</p>}
              </div>
            )}
          </details>
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
                  <span>保留复盘结论：{data.path.changeImpact.preservedReviewedMilestones ?? 0}</span>
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
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                            isComplete ? "bg-green-500 border-green-500 text-white" : "border-border/50"
                          )} style={{ borderColor: !isComplete ? subColor + "60" : undefined }}>
                            {isComplete && <span className="text-xs">✓</span>}
                          </div>

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
                              {m.reviewOutcome && <span className="text-xs text-muted-foreground">复盘：{m.reviewOutcome === "achieved" ? "已达成" : m.reviewOutcome === "relearn" ? "需要重学" : "继续巩固"}</span>}
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
                            {!data.isDraft && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button size="sm" variant={isComplete ? "outline" : "secondary"} onClick={() => openReview(m)} disabled={!!updatingId}>
                                  {isComplete ? "查看复盘" : "复盘并确认"}
                                </Button>
                                {!isComplete && evidenceByMilestone[m.id]?.reviewReady && <span className="text-xs font-medium text-success">已积累足够证据，可以复盘</span>}
                                {!isComplete && <Button size="sm" variant="ghost" onClick={() => loadEvidence(m.id).catch(() => undefined)}>查看学习证据</Button>}
                              </div>
                            )}
                            {evidenceByMilestone[m.id] && (
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                证据：关联任务 {evidenceByMilestone[m.id].tasks.completed}/{evidenceByMilestone[m.id].tasks.total} · 学习 {evidenceByMilestone[m.id].learning.minutes} 分钟 · 练习 {evidenceByMilestone[m.id].practice.completed} 次 · 错题复习 {evidenceByMilestone[m.id].wrongQuestions.reviewed} 道
                              </p>
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

        {reviewingMilestone && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="里程碑复盘">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
              <p className="text-xs font-medium text-brand">里程碑复盘</p>
              <h2 className="mt-1 text-lg font-semibold">{reviewingMilestone.title}</h2>
              {evidenceByMilestone[reviewingMilestone.id] ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{evidenceByMilestone[reviewingMilestone.id].prompt}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">关联任务</p><p className="mt-1 text-sm font-semibold">{evidenceByMilestone[reviewingMilestone.id].tasks.completed}/{evidenceByMilestone[reviewingMilestone.id].tasks.total} 已完成</p><p className="mt-1 text-xs text-muted-foreground">已沉淀 {evidenceByMilestone[reviewingMilestone.id].tasks.completedMinutes}/{evidenceByMilestone[reviewingMilestone.id].tasks.plannedMinutes} 分钟计划量</p></div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">学习会话</p><p className="mt-1 text-sm font-semibold">{evidenceByMilestone[reviewingMilestone.id].learning.sessions} 次 · {evidenceByMilestone[reviewingMilestone.id].learning.minutes} 分钟</p><p className="mt-1 text-xs text-muted-foreground">清晰 {evidenceByMilestone[reviewingMilestone.id].learning.clear} · 需练习 {evidenceByMilestone[reviewingMilestone.id].learning.needsPractice} · 卡点 {evidenceByMilestone[reviewingMilestone.id].learning.blocked}</p></div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">对应练习</p><p className="mt-1 text-sm font-semibold">{evidenceByMilestone[reviewingMilestone.id].practice.completed} 次完成</p><p className="mt-1 text-xs text-muted-foreground">{evidenceByMilestone[reviewingMilestone.id].practice.averageRate === null ? "尚无可用得分" : `有分练习平均正确率 ${evidenceByMilestone[reviewingMilestone.id].practice.averageRate}%`}</p></div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">错题复习</p><p className="mt-1 text-sm font-semibold">{evidenceByMilestone[reviewingMilestone.id].wrongQuestions.reviewed} 道已复习</p><p className="mt-1 text-xs text-muted-foreground">只统计明确关联到当前里程碑的复习记录。</p></div>
                  </div>
                  <div className="mt-4 rounded-xl border border-border/60">
                    <div className="flex items-center justify-between border-b border-border/50 px-3 py-2"><p className="text-xs font-medium">具体学习证据</p><p className="text-[11px] text-muted-foreground">最近 {Math.min(evidenceByMilestone[reviewingMilestone.id].items.length, 8)} 条</p></div>
                    <div className="divide-y divide-border/50">
                      {evidenceByMilestone[reviewingMilestone.id].items.slice(0, 8).map((item) => {
                        const content = <><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.kindLabel} · {new Date(item.occurredAt).toLocaleDateString("zh-CN")}{item.durationMinutes ? ` · ${item.durationMinutes} 分钟` : ""}{item.maxScore ? ` · ${item.score ?? 0}/${item.maxScore} 分` : ""}</p></div><span className="shrink-0 text-xs text-brand">{item.href ? "查看 →" : "已记录"}</span></>;
                        return item.href
                          ? <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40">{content}</Link>
                          : <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">{content}</div>;
                      })}
                      {evidenceByMilestone[reviewingMilestone.id].items.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">尚无明确归属的完成记录。未归属行为不会被猜测计入。</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs"><Link href="/tasks" className="font-medium text-brand hover:underline">查看关联任务 →</Link><Link href={`/wrong-questions?subject=${encodeURIComponent(reviewingMilestone.subject)}`} className="font-medium text-brand hover:underline">查看本科学错题 →</Link></div>
                </>
              ) : <p className="mt-2 text-sm text-muted-foreground">正在汇总任务、学习、练习和错题证据…</p>}
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} placeholder="写下确认依据、薄弱点或下一步（可选）" className="mt-4 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm" />
              <p className="mt-2 text-xs text-muted-foreground">选择结论才会更新里程碑；任务完成不会自动代表掌握。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => submitReview("achieved")} disabled={!!updatingId}>确认达成</Button>
                <Button variant="outline" onClick={() => submitReview("continue")} disabled={!!updatingId}>继续巩固</Button>
                <Button variant="outline" onClick={() => submitReview("relearn")} disabled={!!updatingId}>需要重学</Button>
                <Button variant="ghost" onClick={() => setReviewingMilestone(null)} disabled={!!updatingId}>取消</Button>
              </div>
            </div>
          </div>
        )}

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
