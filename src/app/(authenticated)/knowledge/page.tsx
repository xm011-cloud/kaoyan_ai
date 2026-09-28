"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleLinks } from "@/components/ui/module-links";
import { getWeekStart, toLocalDateString } from "@/lib/date-utils";

type NoteKind = "note" | "key_point" | "question" | "error" | "method";

interface UnderstandingNote {
  id: string;
  content: string;
  kind: NoteKind;
  createdAt: string;
  reviewCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  curriculumNodeIds: string[];
  lesson?: { id: string; title: string; unit: { title: string; course: { title: string; subject: string | null } } } | null;
  task?: { id: string; title: string; subject: string | null; date: string } | null;
  wrongQuestion?: { id: string; subject: string; question: string; tags: string[] } | null;
  knowledgeLinks?: Array<{ node: { id: string; name: string; subject: string; category: string } }>;
}

interface KnowledgeNodeOption {
  id: string;
  name: string;
  subject: string;
  category: string;
}

interface CurriculumSource { label: string; url: string; reviewedAt: string }
interface CurriculumOutlineSummary { id: string; subject: string; version: string; label: string; source: CurriculumSource; nodeCount: number }
interface CurriculumOutline extends CurriculumOutlineSummary { nodes: Array<{ id: string; title: string; parentId: string | null; prerequisites: string[] }> }
interface CurriculumNodeReference { id: string; title: string; outlineLabel: string }

const NOTE_KIND_META: Record<NoteKind, { label: string; tone: string }> = {
  note: { label: "我的理解", tone: "bg-brand/10 text-brand" },
  key_point: { label: "重点", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  question: { label: "待弄懂", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  error: { label: "易错点", tone: "bg-destructive/10 text-destructive" },
  method: { label: "解题思路", tone: "bg-success/10 text-success" },
};

function noteSource(note: UnderstandingNote): { label: string; href: string } | null {
  if (note.task) {
    const week = toLocalDateString(getWeekStart(new Date(note.task.date)));
    return { label: `任务 · ${note.task.title}`, href: `/tasks?week=${week}&task=${note.task.id}` };
  }
  if (note.wrongQuestion) return { label: `错题 · ${note.wrongQuestion.subject}`, href: `/wrong-questions?question=${note.wrongQuestion.id}` };
  if (note.lesson) return { label: `课程 · ${note.lesson.unit.course.title} / ${note.lesson.title}`, href: `/courses?lesson=${note.lesson.id}` };
  return null;
}

export default function KnowledgePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dueOnly = searchParams.get("dueToday") === "true";
  const taskId = searchParams.get("taskId");
  const wrongQuestionId = searchParams.get("wrongQuestionId");
  const sourceFilter = taskId
    ? { key: "taskId", value: taskId, label: "这项任务留下的理解" }
    : wrongQuestionId
      ? { key: "wrongQuestionId", value: wrongQuestionId, label: "这道错题留下的理解" }
      : null;
  const [notes, setNotes] = useState<UnderstandingNote[]>([]);
  const [nodes, setNodes] = useState<KnowledgeNodeOption[]>([]);
  const [outlines, setOutlines] = useState<CurriculumOutlineSummary[]>([]);
  const [curriculumNodes, setCurriculumNodes] = useState<CurriculumNodeReference[]>([]);
  const [activeOutline, setActiveOutline] = useState<CurriculumOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKind, setActiveKind] = useState<"all" | NoteKind>("all");
  const [error, setError] = useState("");
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null);
  const [linkingCurriculumNoteId, setLinkingCurriculumNoteId] = useState<string | null>(null);
  const [reviewingNoteId, setReviewingNoteId] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const noteParams = new URLSearchParams();
      if (dueOnly) noteParams.set("dueToday", "true");
      if (sourceFilter) noteParams.set(sourceFilter.key, sourceFilter.value);
      const [notesResponse, nodesResponse, outlinesResponse] = await Promise.all([
        fetch(`/api/study-notes${noteParams.size ? `?${noteParams.toString()}` : ""}`, { cache: "no-store" }),
        fetch("/api/knowledge-graph", { cache: "no-store" }),
        fetch("/api/curriculum?includeNodes=true", { cache: "no-store" }),
      ]);
      const [noteData, nodeData, outlineData] = await Promise.all([
        notesResponse.json().catch(() => ({})),
        nodesResponse.json().catch(() => ({})),
        outlinesResponse.json().catch(() => ({})),
      ]);
      if (!notesResponse.ok) throw new Error(noteData.error || "加载理解记录失败");
      setNotes(Array.isArray(noteData.notes) ? noteData.notes : []);
      setNodes(nodesResponse.ok && Array.isArray(nodeData.nodes) ? nodeData.nodes : []);
      const detailedOutlines: CurriculumOutline[] = outlinesResponse.ok && Array.isArray(outlineData.outlines) ? outlineData.outlines : [];
      setOutlines(detailedOutlines.map(({ nodes: outlineNodes, ...outline }) => ({ ...outline, nodeCount: outlineNodes.length })));
      // 卡片上的已确认关联必须始终可见，不依赖用户刚好展开了对应的课程目录。
      setCurriculumNodes(detailedOutlines.flatMap((outline) => outline.nodes.map((node) => ({ id: node.id, title: node.title, outlineLabel: outline.label }))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载理解记录失败");
    } finally {
      setLoading(false);
    }
  }, [dueOnly, sourceFilter?.key, sourceFilter?.value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初次请求由异步回调写入远端结果，不会形成同步渲染循环。
    void loadNotes();
  }, [loadNotes]);

  const visibleNotes = useMemo(
    () => activeKind === "all" ? notes : notes.filter((note) => note.kind === activeKind),
    [activeKind, notes],
  );

  const setDueOnly = (next: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("dueToday", "true");
    else params.delete("dueToday");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  const clearSourceFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    params.delete("wrongQuestionId");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  const linkedCurriculumNodesById = useMemo(
    () => new Map(curriculumNodes.map((node) => [node.id, node])),
    [curriculumNodes],
  );

  const linkKnowledgeNode = async (note: UnderstandingNote, nodeId: string) => {
    if (!nodeId || linkingNoteId) return;
    const currentIds = note.knowledgeLinks?.map((link) => link.node.id) ?? [];
    if (currentIds.includes(nodeId)) return;
    setLinkingNoteId(note.id);
    try {
      const response = await fetch(`/api/study-notes/${note.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeNodeIds: [...currentIds, nodeId] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "关联知识点失败");
      setNotes((current) => current.map((item) => item.id === note.id ? { ...item, knowledgeLinks: data.note.knowledgeLinks } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "关联知识点失败");
    } finally {
      setLinkingNoteId(null);
    }
  };

  const reviewNote = async (note: UnderstandingNote, rating: "clear" | "fuzzy" | "blocked") => {
    if (reviewingNoteId) return;
    setReviewingNoteId(note.id);
    try {
      const response = await fetch(`/api/study-notes/${note.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "保存回顾失败");
      setNotes((current) => current
        .map((item) => item.id === note.id ? { ...item, ...data.note } : item)
        // 当前在“待回顾”队列时，清晰/模糊后的记录立即退出队列；“需要重看”仍保留。
        .filter((item) => !dueOnly || item.id !== note.id || (item.nextReviewAt != null && new Date(item.nextReviewAt) <= new Date())));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存回顾失败");
    } finally {
      setReviewingNoteId(null);
    }
  };

  const linkCurriculumNode = async (note: UnderstandingNote, nodeId: string) => {
    if (!nodeId || linkingCurriculumNoteId) return;
    const currentIds = note.curriculumNodeIds ?? [];
    if (currentIds.includes(nodeId)) return;
    setLinkingCurriculumNoteId(note.id);
    try {
      const response = await fetch(`/api/study-notes/${note.id}/curriculum`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumNodeIds: [...currentIds, nodeId] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "关联课程知识点失败");
      setNotes((current) => current.map((item) => item.id === note.id ? { ...item, curriculumNodeIds: data.note.curriculumNodeIds ?? [] } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "关联课程知识点失败");
    } finally {
      setLinkingCurriculumNoteId(null);
    }
  };

  const openOutline = async (outline: CurriculumOutlineSummary) => {
    try {
      const response = await fetch(`/api/curriculum?outlineId=${encodeURIComponent(outline.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.outline) throw new Error(data.error || "加载课程知识路径失败");
      setActiveOutline(data.outline);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载课程知识路径失败");
    }
  };

  return (
    <div className="workspace-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="我的理解与方法" subtitle="这里不复述教材：留下你当时如何理解、为什么会错，以及下次如何切入。" />

        <section className="workspace-surface border-brand/20 bg-brand/5 p-4">
          <p className="text-sm font-medium">把学习串起来，而不是堆一堆笔记</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">从课程、计划任务或错题现场记录；每条记录都保留来源，之后可以回到原任务继续验证。</p>
        </section>

        {dueOnly && (
          <section className="workspace-surface border-amber-300/50 bg-amber-50/70 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
            <p className="text-sm font-medium">今日待回顾</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">先尝试复述自己的理解或解题思路，再如实标记状态；这不会自动改变你的掌握度。</p>
            <button type="button" onClick={() => setDueOnly(false)} className="mt-2 min-h-10 text-sm font-medium text-brand hover:underline">查看全部理解记录 →</button>
          </section>
        )}

        {sourceFilter && (
          <section className="workspace-surface border-success/25 bg-success/5 p-4">
            <p className="text-sm font-medium">当前只显示{sourceFilter.label}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">你可以确认刚刚的表述是否已经沉淀下来，再回到来源继续学习或复盘。</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={sourceFilter.key === "taskId" ? "/tasks" : "/wrong-questions"} className="text-sm font-medium text-brand hover:underline">回到来源 →</Link>
              <button type="button" onClick={clearSourceFilter} className="text-sm font-medium text-brand hover:underline">查看全部理解记录 →</button>
            </div>
          </section>
        )}

        {outlines.length > 0 && (
          <section className="workspace-surface p-4">
            <p className="text-sm font-medium">课程知识路径</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">系统维护的主干只用于导航与前置关系，不替代你的个人理解记录。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {outlines.map((outline) => <button key={outline.id} type="button" onClick={() => void openOutline(outline)} className="min-h-10 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm transition-colors hover:border-brand/30 hover:bg-brand/5">{outline.label} · {outline.nodeCount} 节点</button>)}
            </div>
            {activeOutline && (
              <div id="curriculum-outline" className="mt-4 border-t border-border/55 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{activeOutline.label}</p><a href={activeOutline.source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-xs text-brand hover:underline">参考来源：{activeOutline.source.label} ↗</a></div><span className="text-xs text-muted-foreground">{activeOutline.version} · 核对于 {activeOutline.source.reviewedAt}</span></div>
                <ol className="mt-3 space-y-2">
                  {activeOutline.nodes.map((node) => <li key={node.id} id={`curriculum-${node.id}`} className="scroll-mt-5 rounded-lg bg-muted/40 px-3 py-2 text-sm"><Link href={`/knowledge/nodes/${node.id}`} className="font-medium hover:text-brand hover:underline">{node.title}</Link>{node.prerequisites.length > 0 && <p className="mt-1 text-xs text-muted-foreground">前置：{node.prerequisites.map((id) => activeOutline.nodes.find((item) => item.id === id)?.title ?? id).join("、")}</p>}</li>)}
                </ol>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-1" aria-label="理解记录筛选">
          <button
            type="button"
            aria-pressed={dueOnly}
            onClick={() => setDueOnly(!dueOnly)}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs transition-colors ${dueOnly ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            今日待回顾 {dueOnly ? notes.length : ""}
          </button>
          {(["all", "note", "method", "error", "question", "key_point"] as const).map((kind) => {
            const label = kind === "all" ? `全部 ${notes.length}` : `${NOTE_KIND_META[kind].label} ${notes.filter((note) => note.kind === kind).length}`;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveKind(kind)}
                className={`min-h-10 shrink-0 rounded-lg px-3 text-xs transition-colors ${activeKind === kind && !dueOnly ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">正在整理你的理解记录…</div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            {error} <button type="button" onClick={() => void loadNotes()} className="ml-2 font-medium underline">重试</button>
          </div>
        ) : visibleNotes.length === 0 ? (
          <section className="workspace-surface border-dashed p-8 text-center">
            <p className="font-medium">{dueOnly ? "今天没有待回顾的理解记录" : "还没有理解记录"}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{dueOnly ? "完成学习时写下的理解，会在后续学习日回到这里等待你复述和验证。" : "学习一节课程、完成一项任务或复盘错题时，写下一句自己的理解或解题思路，它会出现在这里。"}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {dueOnly && <button type="button" onClick={() => setDueOnly(false)} className="text-sm font-medium text-brand hover:underline">查看全部理解记录 →</button>}
              <Link href="/courses" className="text-sm font-medium text-brand hover:underline">去课程学习 →</Link>
              <Link href="/tasks" className="text-sm font-medium text-brand hover:underline">查看今日任务 →</Link>
              <Link href="/wrong-questions" className="text-sm font-medium text-brand hover:underline">复盘错题 →</Link>
            </div>
          </section>
        ) : (
          <div className="space-y-3">
            {visibleNotes.map((note) => {
              const meta = NOTE_KIND_META[note.kind] ?? NOTE_KIND_META.note;
              const source = noteSource(note);
              return (
                <article key={note.id} className="workspace-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                    <time className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString("zh-CN")}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.content}</p>
                  <div className="mt-3 rounded-lg bg-muted/45 px-3 py-2.5">
                    <p className="text-xs leading-5 text-muted-foreground">先在脑中复述这条理解或思路，再按真实状态记录。它只决定下次回顾时间，不会自动认定你已经掌握。</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" disabled={reviewingNoteId === note.id} onClick={() => void reviewNote(note, "clear")} className="min-h-9 rounded-md bg-success/10 px-2 text-xs font-medium text-success hover:bg-success/15 disabled:opacity-50">能复述</button>
                      <button type="button" disabled={reviewingNoteId === note.id} onClick={() => void reviewNote(note, "fuzzy")} className="min-h-9 rounded-md bg-amber-500/10 px-2 text-xs font-medium text-amber-700 hover:bg-amber-500/15 disabled:opacity-50 dark:text-amber-300">有点模糊</button>
                      <button type="button" disabled={reviewingNoteId === note.id} onClick={() => void reviewNote(note, "blocked")} className="min-h-9 rounded-md bg-destructive/10 px-2 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50">需要重看</button>
                      {note.nextReviewAt && <span className="text-xs text-muted-foreground">下次回顾：{new Date(note.nextReviewAt).toLocaleDateString("zh-CN")}</span>}
                    </div>
                  </div>
                  {(note.knowledgeLinks?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="关联知识点">
                      {note.knowledgeLinks!.map(({ node }) => (
                        <Link key={node.id} href={`/knowledge-graph?subject=${encodeURIComponent(node.subject)}`} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand">
                          {node.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {note.curriculumNodeIds?.some((id) => linkedCurriculumNodesById.has(id)) && (
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="关联课程知识点">
                      {note.curriculumNodeIds.filter((id) => linkedCurriculumNodesById.has(id)).map((id) => (
                        <Link key={id} href={`/knowledge/nodes/${id}`} className="rounded-full bg-brand/10 px-2 py-1 text-xs text-brand transition-colors hover:bg-brand/20">
                          {linkedCurriculumNodesById.get(id)?.outlineLabel} · {linkedCurriculumNodesById.get(id)?.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-brand">关联知识点</summary>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {nodes.length > 0 ? (
                        <select
                          aria-label={`为理解记录关联知识点：${note.id}`}
                          defaultValue=""
                          disabled={linkingNoteId === note.id}
                          onChange={(event) => { void linkKnowledgeNode(note, event.target.value); event.currentTarget.value = ""; }}
                          className="h-10 min-w-48 rounded-lg border border-border/60 bg-background px-2 text-xs"
                        >
                          <option value="">选择一个已有知识点</option>
                          {nodes.filter((node) => !note.knowledgeLinks?.some((link) => link.node.id === node.id)).map((node) => <option key={node.id} value={node.id}>{node.subject} · {node.name}</option>)}
                        </select>
                      ) : (
                        <p className="text-xs text-muted-foreground">先从错题标签构建知识点，再回到这里关联你的理解。</p>
                      )}
                      {linkingNoteId === note.id && <span className="text-xs text-muted-foreground">保存中…</span>}
                    </div>
                  </details>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-brand">关联课程知识点</summary>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {activeOutline ? (
                        <>
                          <select
                            aria-label={`为理解记录关联课程知识点：${note.id}`}
                            defaultValue=""
                            disabled={linkingCurriculumNoteId === note.id}
                            onChange={(event) => { void linkCurriculumNode(note, event.target.value); event.currentTarget.value = ""; }}
                            className="h-10 min-w-48 rounded-lg border border-border/60 bg-background px-2 text-xs"
                          >
                            <option value="">选择 {activeOutline.label} 中的节点</option>
                            {activeOutline.nodes.filter((node) => !note.curriculumNodeIds?.includes(node.id)).map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
                          </select>
                          <p className="text-xs text-muted-foreground">只在你确认后保存，不会自动判断归属。</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">先在上方打开一条已审核的课程知识路径，再选择要关联的节点。</p>
                      )}
                      {linkingCurriculumNoteId === note.id && <span className="text-xs text-muted-foreground">保存中…</span>}
                    </div>
                  </details>
                  {source && <Link href={source.href} className="mt-3 inline-flex text-xs font-medium text-brand hover:underline">{source.label} →</Link>}
                </article>
              );
            })}
          </div>
        )}

        <ModuleLinks links={[
          { href: "/courses", icon: "🎬", label: "课程学习" },
          { href: "/tasks", icon: "📋", label: "备考计划" },
          { href: "/wrong-questions", icon: "📕", label: "错题复盘" },
          { href: "/knowledge-graph", icon: "🧠", label: "知识关系图" },
        ]} />
      </div>
    </div>
  );
}
