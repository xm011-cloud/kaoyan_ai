"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AiWaiting } from "@/components/ai-waiting";
import { useAiTask } from "@/hooks/use-ai-task";

interface Question {
  id: string;
  subject: string;
  question: string;
  answer: string;
  source: string;
  tags: string[];
  reviewCount: number;
  easeFactor: number;
  interval: number;
  createdAt: string;
}

interface SimilarQuestion {
  question: string;
  answer: string;
  explanation: string;
}

const SOURCE_LABELS: Record<string, string> = {
  chat: "💬 AI问答",
  practice: "✏️ 练习",
  manual: "✍️ 手动",
};

function sourceLabel(s: string) {
  return SOURCE_LABELS[s] || s;
}

interface DetailModalProps {
  question: Question;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function DetailModal({ question, onClose, onDelete }: DetailModalProps) {
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [generatingSimilar, setGeneratingSimilar] = useState(false);
  const [reflectionKind, setReflectionKind] = useState<"error" | "method">("error");
  const [reflection, setReflection] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionMessage, setReflectionMessage] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const { phase: waitPhase, estimate: waitEstimate, start: waitStart, stop: waitStop, cancel: waitCancel } = useAiTask();

  const handleGenerateSimilar = async () => {
    setGeneratingSimilar(true);
    setSimilarQuestions([]);
    const controller = waitStart();
    try {
      const res = await fetch("/api/ai/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongQuestionId: question.id, count: 3 }),
        signal: controller.signal,
      });
      const data = await res.json();
      setSimilarQuestions(data.questions || []);
    } catch {
      // 用户主动取消：安静收场
    } finally {
      waitStop();
      setGeneratingSimilar(false);
    }
  };

  const saveReflection = async () => {
    const content = reflection.trim();
    if (!content) return;
    setSavingReflection(true);
    setReflectionMessage("");
    setReflectionSaved(false);
    try {
      const response = await fetch("/api/study-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongQuestionId: question.id, kind: reflectionKind, content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "保存失败");
      setReflection("");
      setReflectionSaved(true);
      setReflectionMessage("已保存到我的理解与方法，可在后续知识卡中继续关联和复习。");
    } catch (error) {
      setReflectionMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setSavingReflection(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => { onClose(); setSimilarQuestions([]); }}
      title="错题详情"
      description={
        <>
          {question.subject} · {sourceLabel(question.source)} ·{" "}
          {new Date(question.createdAt).toLocaleDateString("zh-CN")}
          {question.interval > 0 && ` · 间隔${question.interval}天 · EF${question.easeFactor.toFixed(1)}`}
        </>
      }
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(question.id)}
            className="text-red-500 hover:text-red-700"
          >
            删除
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => { onClose(); setSimilarQuestions([]); }}>关闭</Button>
        </>
      }
    >
      <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">题目</h4>
            <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed">
              {question.question}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">答案/解析</h4>
            <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed">
              {question.answer}
            </div>
          </div>
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {question.tags.map((t, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}

          <section className="rounded-xl border border-brand/20 bg-brand/5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium">留下你的理解与方法</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">不要只收藏答案：写下这次为什么错，以及下次遇到这类题先检查什么。</p>
              </div>
              <select
                aria-label="记录类型"
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
              onChange={(event) => { setReflection(event.target.value); setReflectionSaved(false); }}
              rows={3}
              placeholder={reflectionKind === "method" ? "例如：先判断题目考察的条件，再从定义或关键约束逐步推导……" : "例如：我把……和……混淆了，下次先检查……"}
              className="mt-3 w-full rounded-lg border border-border/60 bg-background p-2.5 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {reflectionMessage && <p className={`text-xs ${reflectionSaved ? "text-success" : "text-destructive"}`}>{reflectionMessage}</p>}
                {reflectionSaved && <Link href={`/knowledge?wrongQuestionId=${question.id}`} className="text-xs font-medium text-brand hover:underline">查看这条理解 →</Link>}
              </div>
              <Button size="sm" onClick={saveReflection} disabled={savingReflection || !reflection.trim()}>
                {savingReflection ? "保存中…" : "保存理解"}
              </Button>
            </div>
          </section>

          {/* AI Similar Questions */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">AI 出类似题</h4>
              <div className="flex items-center gap-3">
                {generatingSimilar && <AiWaiting variant="inline" phase={waitPhase} estimate={waitEstimate} onCancel={waitCancel} />}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSimilar}
                  disabled={generatingSimilar}
                >
                  {generatingSimilar ? "生成中..." : similarQuestions.length > 0 ? "重新生成" : "生成练习题"}
                </Button>
              </div>
            </div>
            {similarQuestions.length > 0 && (
              <div className="space-y-3">
                {similarQuestions.map((sq, i) => (
                  <details key={i} className="bg-muted/50 rounded-xl p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {i + 1}. {sq.question.slice(0, 60)}...
                    </summary>
                    <div className="mt-2 space-y-2 pt-2 border-t border-border/50">
                      <p><strong>答案：</strong>{sq.answer}</p>
                      <p><strong>解析：</strong>{sq.explanation}</p>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
      </div>
    </Modal>
  );
}
