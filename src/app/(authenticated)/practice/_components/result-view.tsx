"use client";

import { Button } from "@/components/ui/button";
import type { PracticeQuestion, PracticeSession } from "@/lib/practice-types";

interface ResultViewProps {
  resultSession: PracticeSession;
  addingWrongId: string | null;
  onAddToWrongBook: (question: PracticeQuestion) => void;
  onBack: () => void;
  onRetry: () => void;
}

export function ResultView({
  resultSession,
  addingWrongId,
  onAddToWrongBook,
  onBack,
  onRetry,
}: ResultViewProps) {
  const questions = resultSession.questions as PracticeQuestion[];
  const scores = resultSession.scores;
  const totalScore = resultSession.totalScore;
  const maxScore = resultSession.maxScore || questions.length * 10;
  const percentage = maxScore > 0 ? Math.round((totalScore || 0) / maxScore * 100) : 0;

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Score summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 text-center">
          <div className="text-5xl mb-3">
            {percentage >= 80 ? "🎉" : percentage >= 60 ? "👍" : "💪"}
          </div>
          <h2 className="text-2xl font-bold">
            {totalScore != null ? `${totalScore} / ${maxScore} 分` : "已完成"}
          </h2>
          <p className="text-gray-500 mt-1">
            {resultSession.type === "daily" ? "每日一练" : "模拟考试"} · {resultSession.subject}
          </p>
          {percentage >= 80 && <p className="text-green-500 font-medium mt-2">表现优秀，继续保持！</p>}
          {percentage >= 60 && percentage < 80 && <p className="text-blue-500 font-medium mt-2">不错，还有提升空间！</p>}
          {percentage < 60 && <p className="text-orange-500 font-medium mt-2">继续努力，多加练习！</p>}
        </div>

        {/* Per-question review */}
        <div className="space-y-3">
          <h3 className="font-semibold">逐题回顾</h3>
          {questions.map((q, i) => {
            const scoreData = scores[q.id];
            const userAnswer = (resultSession.answers as Record<string, string>)[q.id] || "";
            const isCorrect =
              q.type === "choice"
                ? userAnswer.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()
                : scoreData && scoreData.maxScore > 0
                ? scoreData.score / scoreData.maxScore >= 0.6
                : false;

            return (
              <div
                key={q.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${
                  isCorrect ? "border-l-4 border-l-green-400" : "border-l-4 border-l-red-400"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      第 {i + 1} 题
                    </span>
                    <span className="text-xs text-gray-400">
                      {q.type === "choice" ? "选择题" : "简答题"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {scoreData && (
                      <span className={`text-xs font-medium ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                        {scoreData.score}/{scoreData.maxScore} 分
                      </span>
                    )}
                    {!isCorrect && (
                      <button
                        onClick={() => onAddToWrongBook(q)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        disabled={addingWrongId === q.id}
                      >
                        {addingWrongId === q.id ? "✅ 已加入" : "🔴 加入错题本"}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium mb-3">{q.question}</p>

                {q.type === "choice" && q.options && (
                  <div className="text-xs space-y-1 mb-3">
                    {q.options.map((opt, j) => {
                      const optLetter = opt.charAt(0);
                      const isUserAnswer = userAnswer === optLetter;
                      const isCorrectAnswer = q.correctAnswer === optLetter;
                      return (
                        <div
                          key={j}
                          className={`px-2 py-1 rounded ${
                            isCorrectAnswer
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 font-medium"
                              : isUserAnswer && !isCorrectAnswer
                              ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                              : ""
                          }`}
                        >
                          {isCorrectAnswer && "✅ "}
                          {isUserAnswer && !isCorrectAnswer && "❌ "}
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "essay" && userAnswer && (
                  <div className="text-xs mb-2">
                    <span className="text-gray-400">你的答案：</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {userAnswer.slice(0, 200)}
                    </span>
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-500 font-medium">查看解析</summary>
                  <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                    <p><strong>正确答案：</strong>{q.correctAnswer}</p>
                    <p><strong>解析：</strong>{q.explanation}</p>
                    {scoreData?.feedback && (
                      <p><strong>评分反馈：</strong>{scoreData.feedback}</p>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>返回列表</Button>
          <Button onClick={onRetry}>再来一组</Button>
        </div>
      </div>
    </div>
  );
}
