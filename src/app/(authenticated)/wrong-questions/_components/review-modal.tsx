"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Question {
  id: string;
  subject: string;
  question: string;
  answer: string;
  tags: string[];
  reviewed: boolean;
  reviewCount: number;
  interval: number;
  nextReviewDate?: string | null;
}

type Reflection = { id: string; content: string; kind: "error" | "method"; createdAt: string };
type CurriculumNode = { id: string; title: string };

// SM-2 的数值仍只存在于内部；用户只需要诚实描述这一次能否回忆和作答。
// “能独立做出”不等于系统判定掌握，只会拉长下一次回顾的间隔。
const REVIEW_OUTCOMES = [
  { value: 1, label: "仍不会", detail: "明天再巩固", color: "bg-red-500 hover:bg-red-600" },
  { value: 3, label: "有点模糊", detail: "短间隔再看", color: "bg-amber-500 hover:bg-amber-600" },
  { value: 5, label: "这次能独立做出", detail: "稍后再回顾", color: "bg-emerald-600 hover:bg-emerald-700" },
];

interface ReviewModalProps {
  question: Question;
  onClose: () => void;
  onReviewed: (id: string, result: { rating: number; reflection: string; reflectionKind: "error" | "method"; curriculumNodeIds: string[] }) => Promise<void>;
}

export function ReviewModal({ question, onClose, onReviewed }: ReviewModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reflectionKind, setReflectionKind] = useState<"error" | "method">("error");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [history, setHistory] = useState<{ questionId: string; notes: Reflection[] } | null>(null);
  const [curriculumNodes, setCurriculumNodes] = useState<CurriculumNode[]>([]);
  const [curriculumNodeId, setCurriculumNodeId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/study-notes?wrongQuestionId=${encodeURIComponent(question.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取历史复盘失败");
        if (!cancelled) setHistory({ questionId: question.id, notes: (data.notes || []).slice(0, 3) });
      })
      .catch(() => { if (!cancelled) setHistory({ questionId: question.id, notes: [] }); });
    return () => { cancelled = true; };
  }, [question.id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/curriculum?subject=${encodeURIComponent(question.subject)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取知识点失败");
        if (!cancelled) setCurriculumNodes(Array.isArray(data.outline?.nodes) ? data.outline.nodes : []);
      })
      .catch(() => { if (!cancelled) setCurriculumNodes([]); });
    return () => { cancelled = true; };
  }, [question.subject]);

  const reflections = history?.questionId === question.id ? history.notes : [];

  const handleRate = async (rating: number) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onReviewed(question.id, {
        rating,
        reflection: reflection.trim(),
        reflectionKind,
        // 题目切换时不保留旧科目的关联；只接受当前已加载的候选知识点。
        curriculumNodeIds: reflection.trim() && curriculumNodes.some((node) => node.id === curriculumNodeId)
          ? [curriculumNodeId]
          : [],
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "复习记录保存失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="text-sm font-normal text-muted-foreground">
          📖 复习模式 · {question.subject}
          {question.interval > 0 && ` · 间隔${question.interval}天`}
        </span>
      }
      footer={
        showAnswer ? (
          <div className="w-full">
            <p className="mb-2 text-center text-xs text-muted-foreground">这次回忆的结果是？</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {REVIEW_OUTCOMES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => void handleRate(r.value)}
                  disabled={submitting}
                  className={`min-h-12 rounded-xl px-3 py-2 text-left text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${r.color}`}
                >
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="mt-0.5 block text-[11px] text-white/80">{r.detail}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button className="min-h-11 w-full sm:w-auto" variant="outline" size="sm" onClick={handleSkip}>暂不复盘</Button>
              <span className="text-center text-xs text-muted-foreground">选择后只安排下次复习；到期队列会自动进入下一题</span>
            </div>
            {submitError && <p className="mt-2 text-center text-xs text-destructive">{submitError}</p>}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="font-medium text-amber-950 dark:text-amber-100">{question.reviewed ? "这道题按上次复习后的间隔，今天再次出现" : "这道题还没有完成过复习"}</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/75 dark:text-amber-100/75">先自己回忆，再查看答案并记录这次的结果。它只安排下一次复习，不会自动代表你已经掌握。</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">题目</h4>
            <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed">
              {question.question}
            </div>
          </div>

          {!showAnswer ? (
            <Button variant="outline" className="min-h-11 w-full" onClick={() => setShowAnswer(true)}>
              👆 点击查看答案
            </Button>
          ) : (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">答案/解析</h4>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-sm leading-relaxed border border-green-200 dark:border-green-800">
                {question.answer}
              </div>
            </div>
          )}

          {showAnswer && (
            <>
            {reflections.length > 0 && (
              <section className="rounded-xl border border-border/60 bg-muted/35 p-3">
                <h4 className="text-sm font-medium">你上次留下的复盘</h4>
                <p className="mt-1 text-xs text-muted-foreground">先对照自己的旧思路，再判断这次是否真的能独立做出。</p>
                <div className="mt-3 space-y-2">
                  {reflections.map((note) => (
                    <div key={note.id} className="rounded-lg bg-background px-3 py-2 text-sm">
                      <span className="text-xs font-medium text-brand">{note.kind === "method" ? "解题思路" : "易错点"}</span>
                      <p className="mt-1 whitespace-pre-wrap leading-6">{note.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="rounded-xl border border-brand/20 bg-brand/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-medium">留下一句复盘（可选）</h4>
                  <p className="mt-1 text-xs text-muted-foreground">写下为什么错，或下次遇到这类题先怎么判断。</p>
                </div>
                <select
                  aria-label="复盘记录类型"
                  value={reflectionKind}
                  onChange={(event) => setReflectionKind(event.target.value as "error" | "method")}
                  className="h-10 rounded-lg border border-border/60 bg-background px-2 text-xs"
                >
                  <option value="error">易错点</option>
                  <option value="method">解题思路</option>
                </select>
              </div>
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                rows={3}
                placeholder={reflectionKind === "method" ? "例如：先判断题干给出的条件，再从定义推导……" : "例如：我把……和……混淆了，下次先检查……"}
                className="mt-3 w-full rounded-lg border border-border/60 bg-background p-2.5 text-sm"
              />
              {curriculumNodes.length > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="wrong-review-curriculum-node">关联一个课程知识点（可选）</label>
                  <select
                    id="wrong-review-curriculum-node"
                    aria-label="为本次复盘关联课程知识点"
                    value={curriculumNodeId}
                    onChange={(event) => setCurriculumNodeId(event.target.value)}
                    disabled={!reflection.trim()}
                    className="h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-xs"
                  >
                    <option value="">暂不关联，之后可在理解库补充</option>
                    {curriculumNodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">先写一句复盘后即可关联；只会保存你主动确认的关联，不会根据题目自动判断。</p>
                </div>
              )}
            </section>
            </>
          )}

          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {question.tags.map((t, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
      </div>
    </Modal>
  );
}
