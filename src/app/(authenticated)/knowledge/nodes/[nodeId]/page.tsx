"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

type SourceNote = {
  id: string;
  content: string;
  kind: string;
  updatedAt: string;
  nextReviewAt: string | null;
  lesson?: { id: string; title: string; unit: { course: { title: string } } } | null;
  task?: { id: string; title: string; subject: string | null; completed: boolean } | null;
  wrongQuestion?: { id: string; subject: string; question: string; reviewed: boolean } | null;
};

type SystemNode = { id: string; title: string; parentId: string | null; prerequisites: string[] };
type NodeDetail = {
  outline: { id: string; subject: string; version: string; label: string };
  node: SystemNode;
  prerequisites: SystemNode[];
  dependents: SystemNode[];
  notes: SourceNote[];
  tasks: Array<{ id: string; title: string; date: string; completed: boolean; duration: number | null; milestoneTitle: string | null }>;
  evidence: { totalNotes: number; dueNotes: number; taskCount: number; taskSourceCount: number; wrongQuestionSourceCount: number; lessonSourceCount: number };
};

const KIND_LABELS: Record<string, string> = {
  note: "我的理解",
  key_point: "重点",
  question: "待弄懂",
  error: "易错点",
  method: "解题思路",
};

const DETAIL_REQUEST_TIMEOUT = 12_000;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchNodeDetail(nodeId: string): Promise<NodeDetail> {
  let lastError: unknown;
  // 详情是纯读取：短暂网络抖动时重试一次，不让用户一直停在加载态。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DETAIL_REQUEST_TIMEOUT);
    try {
      const response = await fetch(`/api/curriculum/nodes/${encodeURIComponent(nodeId)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data as NodeDetail;
      const error = new Error(data.error || "加载课程知识点失败");
      if (response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt === 0) await wait(500);
  }

  if (lastError instanceof DOMException && lastError.name === "AbortError") {
    throw new Error("加载超时，请检查网络后重试");
  }
  throw lastError instanceof Error ? lastError : new Error("加载课程知识点失败");
}

function sourceFor(note: SourceNote): { label: string; href: string } | null {
  if (note.task) return { label: `任务 · ${note.task.title}`, href: `/tasks?task=${note.task.id}` };
  if (note.wrongQuestion) return { label: `错题 · ${note.wrongQuestion.subject}`, href: `/wrong-questions?question=${note.wrongQuestion.id}` };
  if (note.lesson) return { label: `课程 · ${note.lesson.unit.course.title} / ${note.lesson.title}`, href: `/courses?lesson=${note.lesson.id}` };
  return null;
}

export default function CurriculumNodePage() {
  const params = useParams<{ nodeId: string }>();
  const nodeId = Array.isArray(params.nodeId) ? params.nodeId[0] : params.nodeId;
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError("");
    try {
      setDetail(await fetchNodeDetail(nodeId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载课程知识点失败");
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 请求状态由异步回调写入远端结果，不形成同步渲染循环。
    void loadDetail();
  }, [loadDetail]);

  if (loading) return <div className="workspace-page"><div className="mx-auto max-w-4xl py-16 text-center text-sm text-muted-foreground">正在整理这个知识点的学习证据…</div></div>;

  if (error || !detail) {
    return (
      <div className="workspace-page"><div className="mx-auto max-w-4xl space-y-4 py-10">
        <p className="text-sm text-destructive">{error || "课程知识点不存在"}</p>
        <div className="flex gap-3"><button type="button" onClick={() => void loadDetail()} className="text-sm font-medium text-brand hover:underline">重试</button><Link href="/knowledge" className="text-sm font-medium text-brand hover:underline">返回理解库</Link></div>
      </div></div>
    );
  }

  const { node, outline, prerequisites, dependents, notes, evidence } = detail;
  return (
    <div className="workspace-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={node.title}
          subtitle={`${outline.label} · ${outline.version}。这里展示你确认过的学习证据，不把记录数量当作掌握结论。`}
          action={<Link href="/knowledge" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border/60 px-3 text-sm font-medium transition-colors hover:bg-muted">返回理解库</Link>}
        />

        <section className="grid gap-3 sm:grid-cols-3" aria-label="学习证据摘要">
          <div className="workspace-surface p-4"><p className="text-xs text-muted-foreground">已关联理解记录</p><p className="mt-1 text-2xl font-semibold tabular-nums">{evidence.totalNotes}</p></div>
          <div className="workspace-surface p-4"><p className="text-xs text-muted-foreground">现在值得回顾</p><p className="mt-1 text-2xl font-semibold tabular-nums">{evidence.dueNotes}</p></div>
          <div className="workspace-surface p-4"><p className="text-xs text-muted-foreground">正在推进的任务</p><p className="mt-1 text-2xl font-semibold tabular-nums">{evidence.taskCount}</p><p className="mt-1 text-xs text-muted-foreground">另有 {evidence.lessonSourceCount} 节课、{evidence.taskSourceCount} 项来源任务和 {evidence.wrongQuestionSourceCount} 道来源错题</p></div>
        </section>

        {(prerequisites.length > 0 || dependents.length > 0) && (
          <section className="workspace-surface p-4">
            <p className="text-sm font-medium">局部学习路径</p>
            {prerequisites.length > 0 && <div className="mt-3"><p className="text-xs text-muted-foreground">建议先确认</p><div className="mt-2 flex flex-wrap gap-2">{prerequisites.map((item) => <Link key={item.id} href={`/knowledge/nodes/${item.id}`} className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">{item.title}</Link>)}</div></div>}
            {dependents.length > 0 && <div className="mt-3"><p className="text-xs text-muted-foreground">后续会用到</p><div className="mt-2 flex flex-wrap gap-2">{dependents.map((item) => <Link key={item.id} href={`/knowledge/nodes/${item.id}`} className="rounded-full bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/15">{item.title}</Link>)}</div></div>}
          </section>
        )}

        <section className="space-y-3">
          <div><h2 className="text-base font-semibold">计划中的任务</h2><p className="mt-1 text-sm text-muted-foreground">这些任务由你在编辑时确认关联到这个节点；完成任务只增加路线证据，不等于已经掌握。</p></div>
          {detail.tasks.length === 0 ? (
            <div className="workspace-surface border-dashed p-5 text-sm text-muted-foreground">还没有任务直接关联到这里。可在计划页编辑任务后选择这个课程知识点。</div>
          ) : <div className="space-y-2">{detail.tasks.map((task) => <Link key={task.id} href={`/tasks?task=${task.id}`} className="workspace-surface flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:border-brand/30 hover:bg-brand/5"><div><p className={task.completed ? "text-sm line-through text-muted-foreground" : "text-sm font-medium"}>{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(task.date).toLocaleDateString("zh-CN")}{task.duration ? ` · ${task.duration} 分钟` : ""}{task.milestoneTitle ? ` · ${task.milestoneTitle}` : ""}</p></div><span className={task.completed ? "text-xs text-success" : "text-xs text-brand"}>{task.completed ? "已完成" : "去执行 →"}</span></Link>)}</div>}
        </section>

        <section className="space-y-3">
          <div><h2 className="text-base font-semibold">你的理解与方法</h2><p className="mt-1 text-sm text-muted-foreground">这些是你亲自确认归属的记录。需要时回到来源场景继续验证，而不是只浏览一遍。</p></div>
          {notes.length === 0 ? (
            <div className="workspace-surface border-dashed p-7 text-center"><p className="font-medium">这里还没有你的学习证据</p><p className="mt-2 text-sm leading-6 text-muted-foreground">从课程、任务或错题写下一句自己的理解，然后在理解库中手动关联到这个知识点。</p><Link href="/knowledge" className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">去记录理解 →</Link></div>
          ) : notes.map((note) => {
            const source = sourceFor(note);
            return <article key={note.id} className="workspace-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{KIND_LABELS[note.kind] ?? "理解记录"}</span><time className="text-xs text-muted-foreground">更新于 {new Date(note.updatedAt).toLocaleDateString("zh-CN")}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.content}</p><div className="mt-3 flex flex-wrap items-center gap-3 text-xs">{note.nextReviewAt && <span className="text-muted-foreground">下次回顾：{new Date(note.nextReviewAt).toLocaleDateString("zh-CN")}</span>}{source && <Link href={source.href} className="font-medium text-brand hover:underline">{source.label} →</Link>}</div></article>;
          })}
        </section>
      </div>
    </div>
  );
}
