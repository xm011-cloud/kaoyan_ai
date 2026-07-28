"use client";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/time-utils";
import type { PracticeQuestion, PracticeSession } from "@/lib/practice-types";

interface ActiveSessionProps {
  session: PracticeSession;
  questions: PracticeQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  timeLeft: number | null;
  elapsedDisplay: number;
  submitting: boolean;
  onAnswerChange: (questionId: string, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function ActiveSession({
  session,
  questions,
  currentIndex,
  answers,
  timeLeft,
  elapsedDisplay,
  submitting,
  onAnswerChange,
  onPrev,
  onNext,
  onSubmit,
  onBack,
}: ActiveSessionProps) {
  const q = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {session.type === "daily" ? "📝 每日一练" : "⏱️ 模拟考试"}
              </span>
              <span className="text-xs text-gray-400">· {session.subject}</span>
            </div>
            <div className="flex items-center gap-3">
              {timeLeft !== null ? (
                <span className={`text-sm font-mono font-bold ${timeLeft < 300 ? "text-red-500" : ""}`}>
                  ⏱️ {formatTime(timeLeft)}
                </span>
              ) : (
                <span className="text-xs text-gray-400">已用时 {formatTime(elapsedDisplay)}</span>
              )}
              <span className="text-xs text-gray-500">
                第 {currentIndex + 1}/{questions.length} 题
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {questions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">🤔</div>
              <p className="font-medium">题目生成中...</p>
              <p className="text-sm mt-1">如果长时间未加载，请返回重试</p>
              <Button variant="outline" className="mt-4" onClick={onBack}>
                返回
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <span className="text-xs font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                {q?.type === "choice" ? "选择题" : "简答题"}
              </span>
              <p className="mt-3 text-sm leading-relaxed font-medium">{q?.question}</p>

              {q?.type === "choice" && q.options && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, i) => {
                    const optLetter = opt.charAt(0);
                    const selected = answers[q?.id || ""] === optLetter;
                    return (
                      <button
                        key={i}
                        onClick={() => onAnswerChange(q?.id || "", optLetter)}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                          selected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-medium"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {q?.type === "essay" && (
                <div className="mt-4">
                  <textarea
                    value={answers[q?.id || ""] || ""}
                    onChange={(e) => onAnswerChange(q?.id || "", e.target.value)}
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-y dark:bg-gray-900 dark:border-gray-700"
                    placeholder="输入你的答案..."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="shrink-0 border-t px-4 py-3 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onPrev} disabled={currentIndex === 0}>
            ← 上一题
          </Button>

          {currentIndex < questions.length - 1 ? (
            <Button onClick={onNext}>下一题 →</Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? "提交中..." : "提交答卷 ✅"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
