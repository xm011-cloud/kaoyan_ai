"use client";

import { useState } from "react";
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
