"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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

  const handleGenerateSimilar = async () => {
    setGeneratingSimilar(true);
    setSimilarQuestions([]);
    try {
      const res = await fetch("/api/ai/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongQuestionId: question.id, count: 3 }),
      });
      const data = await res.json();
      setSimilarQuestions(data.questions || []);
    } catch {
      // ignore
    } finally {
      setGeneratingSimilar(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { onClose(); setSimilarQuestions([]); }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg">错题详情</h3>
            <p className="text-xs text-gray-500">
              {question.subject} · {sourceLabel(question.source)} ·{" "}
              {new Date(question.createdAt).toLocaleDateString("zh-CN")}
              {question.interval > 0 && ` · 间隔${question.interval}天 · EF${question.easeFactor.toFixed(1)}`}
            </p>
          </div>
          <button
            onClick={() => { onClose(); setSimilarQuestions([]); }}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">题目</h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed">
              {question.question}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">答案/解析</h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed">
              {question.answer}
            </div>
          </div>
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {question.tags.map((t, i) => (
                <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}

          {/* AI Similar Questions */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">AI 出类似题</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateSimilar}
                disabled={generatingSimilar}
              >
                {generatingSimilar ? "生成中..." : similarQuestions.length > 0 ? "重新生成" : "生成练习题"}
              </Button>
            </div>
            {similarQuestions.length > 0 && (
              <div className="space-y-3">
                {similarQuestions.map((sq, i) => (
                  <details key={i} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {i + 1}. {sq.question.slice(0, 60)}...
                    </summary>
                    <div className="mt-2 space-y-2 pt-2 border-t dark:border-gray-700">
                      <p><strong>答案：</strong>{sq.answer}</p>
                      <p><strong>解析：</strong>{sq.explanation}</p>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 shrink-0">
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
        </div>
      </div>
    </div>
  );
}
