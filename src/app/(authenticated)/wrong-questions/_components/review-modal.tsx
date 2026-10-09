"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Question {
  id: string;
  subject: string;
  question: string;
  answer: string;
  tags: string[];
  reviewed: boolean;
  interval: number;
}

const RATINGS = [
  { value: 0, label: "完全忘了", color: "bg-red-500 hover:bg-red-600" },
  { value: 1, label: "很模糊", color: "bg-orange-500 hover:bg-orange-600" },
  { value: 2, label: "有点难", color: "bg-yellow-500 hover:bg-yellow-600" },
  { value: 3, label: "还可以", color: "bg-lime-500 hover:bg-lime-600" },
  { value: 4, label: "基本会", color: "bg-emerald-500 hover:bg-emerald-600" },
  { value: 5, label: "很熟练", color: "bg-green-500 hover:bg-green-600" },
];

interface ReviewModalProps {
  question: Question;
  onClose: () => void;
  onReviewed: (id: string, result: { rating: number; reflection: string; reflectionKind: "error" | "method" }) => Promise<void>;
}

export function ReviewModal({ question, onClose, onReviewed }: ReviewModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reflectionKind, setReflectionKind] = useState<"error" | "method">("error");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleRate = async (rating: number) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onReviewed(question.id, { rating, reflection: reflection.trim(), reflectionKind });
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
            <p className="text-xs text-muted-foreground mb-2 text-center">你对这道题的掌握程度？</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => void handleRate(r.value)}
                  disabled={submitting}
                  className={`min-h-11 rounded-lg px-1 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${r.color}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button className="min-h-11 w-full sm:w-auto" variant="outline" size="sm" onClick={handleSkip}>暂不评分</Button>
              <span className="text-center text-xs text-muted-foreground">评分后会安排下一次复习；到期队列会自动进入下一题</span>
            </div>
            {submitError && <p className="mt-2 text-center text-xs text-destructive">{submitError}</p>}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
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
            </section>
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
