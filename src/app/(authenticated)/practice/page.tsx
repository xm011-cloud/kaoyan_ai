"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface PracticeQuestion {
  id: string;
  type: "choice" | "essay";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  scoringPoints?: string[];
}

interface PracticeSession {
  id: string;
  type: "daily" | "mock";
  subject: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: PracticeQuestion[];
  answers: Record<string, string>;
  scores: Record<string, { score: number; maxScore: number; feedback: string }>;
  totalScore: number | null;
  maxScore: number | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function PracticePage() {
  // State
  const [view, setView] = useState<"main" | "active" | "result">("main");
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);

  // Create form
  const [createType, setCreateType] = useState<"daily" | "mock">("daily");
  const [createSubject, setCreateSubject] = useState("");
  const [createDuration, setCreateDuration] = useState(180);
  const [creating, setCreating] = useState(false);

  // Active session
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result session (viewing past results)
  const [resultSession, setResultSession] = useState<PracticeSession | null>(null);

  // Wrong book integration
  const [addingWrongId, setAddingWrongId] = useState<string | null>(null);
  const [wrongSubject, setWrongSubject] = useState("");

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/practice?limit=30");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch("/api/goal");
      const data = await res.json();
      if (data.goal?.subjects) {
        setSubjects(data.goal.subjects);
        setCreateSubject(data.goal.subjects[0] || "");
        setWrongSubject(data.goal.subjects[0] || "");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadSubjects();
  }, [loadSessions, loadSubjects]);

  // Timer logic
  useEffect(() => {
    if (view === "active" && session?.type === "mock" && timeLeft !== null) {
      if (timeLeft <= 0) {
        handleSubmit();
        return;
      }
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t !== null && t > 0 ? t - 1 : 0));
        setElapsed((e) => e + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (view === "active" && session?.type === "daily") {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [view, session?.type, timeLeft]);

  const handleCreate = async () => {
    if (!createSubject) return;
    setCreating(true);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: createType,
          subject: createSubject,
          duration: createType === "mock" ? createDuration : undefined,
        }),
      });
      const data = await res.json();
      if (data.session) {
        const s = data.session as PracticeSession;
        setSession(s);
        setAnswers({});
        setCurrentIndex(0);
        setElapsed(0);
        if (s.type === "mock") {
          setTimeLeft((s.duration || 180) * 60);
        } else {
          setTimeLeft(null);
        }
        setView("active");
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(`/api/practice/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setResultSession(data.session);
        setView("result");
        loadSessions();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResult = async (s: PracticeSession) => {
    if (s.status === "completed") {
      try {
        const res = await fetch(`/api/practice/${s.id}`);
        const data = await res.json();
        if (data.session) {
          setResultSession(data.session);
          setView("result");
        }
      } catch {
        // ignore
      }
    }
  };

  const handleAddToWrongBook = async (q: PracticeQuestion) => {
    if (!resultSession) return;
    const userAnswer = resultSession.answers[q.id] || "";
    const scoreData = resultSession.scores[q.id];

    // Only add if answer was wrong (score < 60% of max)
    if (
      scoreData &&
      scoreData.maxScore > 0 &&
      scoreData.score / scoreData.maxScore >= 0.6
    ) {
      return; // Answered correctly, skip
    }

    try {
      await fetch("/api/wrong-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: resultSession.subject,
          question: q.question,
          answer: `正确答案：${q.correctAnswer}\n解析：${q.explanation}\n你的答案：${userAnswer || "（未作答）"}`,
          source: "practice",
          tags: [resultSession.subject],
        }),
      });
      setAddingWrongId(q.id);
      setTimeout(() => setAddingWrongId(null), 1500);
    } catch {
      // ignore
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ── MAIN VIEW ──
  if (view === "main") {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">练习</h1>

          {/* Create cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily */}
            <div
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                createType === "daily"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
              }`}
              onClick={() => setCreateType("daily")}
            >
              <div className="text-3xl mb-2">📝</div>
              <h3 className="font-bold text-lg">每日一练</h3>
              <p className="text-sm text-gray-500 mt-1">
                每天 5 道题，巩固知识点，保持学习节奏
              </p>
            </div>

            {/* Mock */}
            <div
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                createType === "mock"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
              }`}
              onClick={() => setCreateType("mock")}
            >
              <div className="text-3xl mb-2">⏱️</div>
              <h3 className="font-bold text-lg">模拟考试</h3>
              <p className="text-sm text-gray-500 mt-1">
                完整模拟考试，计时作答，检验真实水平
              </p>
            </div>
          </div>

          {/* Config */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium mb-1">科目</label>
                <select
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {subjects.length === 0 && (
                    <option value="">请先设置考研目标</option>
                  )}
                </select>
              </div>

              {createType === "mock" && (
                <div className="w-32">
                  <label className="block text-sm font-medium mb-1">
                    考试时长（分钟）
                  </label>
                  <input
                    type="number"
                    value={createDuration}
                    onChange={(e) =>
                      setCreateDuration(parseInt(e.target.value) || 180)
                    }
                    min={30}
                    max={360}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={creating || !createSubject}
                className={
                  createType === "mock"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                {creating
                  ? "生成题目中..."
                  : createType === "daily"
                  ? "开始练习 ✏️"
                  : "开始考试 ⏱️"}
              </Button>
            </div>
          </div>

          {/* History */}
          <div>
            <h2 className="font-semibold text-lg mb-3">练习记录</h2>
            {loadingSessions ? (
              <p className="text-sm text-gray-500">加载中...</p>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <div className="text-4xl mb-3">✏️</div>
                <p>还没有练习记录</p>
                <p className="text-sm">开始你的第一次练习吧</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleViewResult(s)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow text-left"
                  >
                    <span className="text-xl">
                      {s.type === "daily" ? "📝" : "⏱️"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            s.type === "daily"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {s.type === "daily" ? "每日一练" : "模拟考试"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {s.subject}
                        </span>
                        {s.status === "completed" && (
                          <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                            已完成
                          </span>
                        )}
                        {s.status === "in_progress" && (
                          <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">
                            进行中
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1">
                        {s.status === "completed"
                          ? s.totalScore != null && s.maxScore
                            ? `得分: ${s.totalScore}/${s.maxScore}`
                            : "已完成"
                          : `${(s.questions as PracticeQuestion[])?.length || 0} 题`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE VIEW ──
  if (view === "active" && session) {
    const questions = session.questions as PracticeQuestion[];
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
                <span className="text-xs text-gray-400">
                  · {session.subject}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {timeLeft !== null ? (
                  <span
                    className={`text-sm font-mono font-bold ${
                      timeLeft < 300 ? "text-red-500" : ""
                    }`}
                  >
                    ⏱️ {formatTime(timeLeft)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    已用时 {formatTime(elapsed)}
                  </span>
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
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setView("main");
                    setSession(null);
                  }}
                >
                  返回
                </Button>
              </div>
            ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <span className="text-xs font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                {q?.type === "choice" ? "选择题" : "简答题"}
              </span>
              <p className="mt-3 text-sm leading-relaxed font-medium">
                {q?.question}
              </p>

              {/* Choice options */}
              {q?.type === "choice" && q.options && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, i) => {
                    const optLetter = opt.charAt(0);
                    const selected = answers[q?.id || ""] === optLetter;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setAnswers({ ...answers, [q?.id || ""]: optLetter })
                        }
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

              {/* Essay input */}
              {q?.type === "essay" && (
                <div className="mt-4">
                  <textarea
                    value={answers[q?.id || ""] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [q?.id || ""]: e.target.value })
                    }
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
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              ← 上一题
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button
                onClick={() =>
                  setCurrentIndex(
                    Math.min(questions.length - 1, currentIndex + 1)
                  )
                }
              >
                下一题 →
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (
                    session.type === "mock" &&
                    !confirm("确定提交试卷吗？提交后无法修改。")
                  )
                    return;
                  handleSubmit();
                }}
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

  // ── RESULT VIEW ──
  if (view === "result" && resultSession) {
    const questions = resultSession.questions as PracticeQuestion[];
    const scores = resultSession.scores;
    const totalScore = resultSession.totalScore;
    const maxScore = resultSession.maxScore || questions.length * 10;
    const percentage =
      maxScore > 0 ? Math.round((totalScore || 0) / maxScore * 100) : 0;

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
              {resultSession.type === "daily" ? "每日一练" : "模拟考试"} ·{" "}
              {resultSession.subject}
            </p>
            {percentage >= 80 && (
              <p className="text-green-500 font-medium mt-2">
                表现优秀，继续保持！
              </p>
            )}
            {percentage >= 60 && percentage < 80 && (
              <p className="text-blue-500 font-medium mt-2">
                不错，还有提升空间！
              </p>
            )}
            {percentage < 60 && (
              <p className="text-orange-500 font-medium mt-2">
                继续努力，多加练习！
              </p>
            )}
          </div>

          {/* Per-question review */}
          <div className="space-y-3">
            <h3 className="font-semibold">逐题回顾</h3>
            {questions.map((q, i) => {
              const scoreData = scores[q.id];
              const userAnswer = (resultSession.answers as Record<string, string>)[q.id] || "";
              const isCorrect =
                q.type === "choice"
                  ? userAnswer.trim().toUpperCase() ===
                    q.correctAnswer.trim().toUpperCase()
                  : scoreData && scoreData.maxScore > 0
                  ? scoreData.score / scoreData.maxScore >= 0.6
                  : false;

              return (
                <div
                  key={q.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${
                    isCorrect
                      ? "border-l-4 border-l-green-400"
                      : "border-l-4 border-l-red-400"
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
                        <span
                          className={`text-xs font-medium ${
                            isCorrect ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {scoreData.score}/{scoreData.maxScore} 分
                        </span>
                      )}
                      {!isCorrect && (
                        <button
                          onClick={() => handleAddToWrongBook(q)}
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
                        const isCorrectAnswer =
                          q.correctAnswer === optLetter;
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
                    <summary className="cursor-pointer text-blue-500 font-medium">
                      查看解析
                    </summary>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                      <p>
                        <strong>正确答案：</strong>
                        {q.correctAnswer}
                      </p>
                      <p>
                        <strong>解析：</strong>
                        {q.explanation}
                      </p>
                      {scoreData?.feedback && (
                        <p>
                          <strong>评分反馈：</strong>
                          {scoreData.feedback}
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setView("main");
                setResultSession(null);
              }}
            >
              返回列表
            </Button>
            <Button
              onClick={() => {
                setCreateType(resultSession.type);
                setCreateSubject(resultSession.subject);
                setView("main");
                setResultSession(null);
                setTimeout(() => handleCreate(), 100);
              }}
            >
              再来一组
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
