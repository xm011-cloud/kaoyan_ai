"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useGoal } from "@/hooks/use-goal";
import { usePracticeTimer } from "@/hooks/use-practice-timer";
import { usePracticeSessions, useCreatePracticeSession, useSubmitPracticeSession } from "@/hooks/use-practice";
import type { PracticeQuestion, PracticeSession } from "@/lib/practice-types";
import { SessionCreator } from "./_components/session-creator";
import { ActiveSession } from "./_components/active-session";
import { ResultView } from "./_components/result-view";

// ── sessionStorage helpers for answers ──
const ANSWERS_KEY_PREFIX = "practice-answers-";

function saveAnswers(sessionId: string, answers: Record<string, string>) {
  try {
    sessionStorage.setItem(ANSWERS_KEY_PREFIX + sessionId, JSON.stringify(answers));
  } catch { /* ignore */ }
}

function loadAnswers(sessionId: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY_PREFIX + sessionId);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function clearAnswers(sessionId: string) {
  try { sessionStorage.removeItem(ANSWERS_KEY_PREFIX + sessionId); } catch { /* ignore */ }
}

export default function PracticePage() {
  // ── URL params ──
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── State ──
  const [view, setView] = useState<"main" | "active" | "result">("main");
  const { data: goal } = useGoal();
  const subjects = goal?.subjects ?? [];

  // ── React Query data ──
  const { data: sessions = [], isLoading: loadingSessions } = usePracticeSessions();

  // Create form
  const [createType, setCreateType] = useState<"daily" | "mock">("daily");
  const [createSubject, setCreateSubject] = useState("");
  const [createDuration, setCreateDuration] = useState(180);

  // ── Mutations ──
  const createSessionMut = useCreatePracticeSession();
  const submitSessionMut = useSubmitPracticeSession();
  const creating = createSessionMut.isPending;
  const submitting = submitSessionMut.isPending;

  // Active session
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Timer
  const {
    timeLeft,
    elapsedDisplay,
    reset: resetTimer,
  } = usePracticeTimer({
    isActive: view === "active" && !!session,
    isMock: session?.type === "mock",
    initialDuration: session?.duration ?? 180,
    onTimeUp: () => handleSubmit(),
  });

  // Result view
  const [resultSession, setResultSession] = useState<PracticeSession | null>(null);
  const [addingWrongId, setAddingWrongId] = useState<string | null>(null);

  // Advanced options
  const [materials, setMaterials] = useState<{ id: string; name: string }[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [useWrongQuestions, setUseWrongQuestions] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Wrong-question subject
  const wrongSubject = useRef("");

  // Restore session from URL params on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    const sessionId = searchParams.get("session");
    const isResult = searchParams.get("result") === "1";
    if (!sessionId) return;
    restoredRef.current = true;

    if (isResult) {
      // Restore result view
      fetch(`/api/practice/${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.session?.status === "completed") {
            setResultSession(data.session as PracticeSession);
            setView("result");
          }
        })
        .catch(() => {});
    } else {
      // Restore active session
      fetch(`/api/practice/${sessionId}`)
        .then(r => r.json())
        .then(data => {
          const s = data.session as PracticeSession;
          if (s && s.status === "in_progress") {
            setSession(s);
            const savedAnswers = loadAnswers(sessionId);
            setAnswers(savedAnswers);
            setCurrentIndex(0);
            setView("active");
            wrongSubject.current = s.subject;
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // ── Data loading (materials only, sessions via React Query) ──
  useEffect(() => {
    fetch("/api/materials?brief=true")
      .then(r => r.json())
      .then(d => setMaterials(d.materials || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (subjects.length > 0 && !createSubject) {
      setCreateSubject(subjects[0]);
    }
  }, [subjects, createSubject]);

  // Persist answers to sessionStorage whenever they change
  useEffect(() => {
    if (session && view === "active") {
      saveAnswers(session.id, answers);
    }
  }, [answers, session, view]);

  // URL navigation helpers
  const navigateToSession = useCallback((sessionId: string) => {
    router.replace(`${pathname}?session=${sessionId}`, { scroll: false });
  }, [router, pathname]);

  const navigateToResult = useCallback((sessionId: string) => {
    router.replace(`${pathname}?session=${sessionId}&result=1`, { scroll: false });
  }, [router, pathname]);

  const navigateToMain = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // ── Handlers ──
  const handleCreate = () => {
    if (!createSubject) return;
    createSessionMut.mutate(
      {
        type: createType,
        subject: createSubject,
        duration: createType === "mock" ? createDuration : undefined,
        materialIds: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        wrongQuestionIds: useWrongQuestions ? [] : undefined,
      },
      {
        onSuccess: (s: PracticeSession) => {
          if (s.status === "in_progress") {
            setSession(s);
            setCurrentIndex(0);
            setAnswers({});
            resetTimer();
            setView("active");
            wrongSubject.current = s.subject;
            navigateToSession(s.id);
          }
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!session || submitting) return;
    const sessionId = session.id;
    submitSessionMut.mutate(
      { id: sessionId, answers },
      {
        onSuccess: (s: PracticeSession) => {
          setResultSession(s);
          setView("result");
          setSession(null);
          clearAnswers(sessionId);
          navigateToResult(sessionId);
        },
      }
    );
  };

  const handleViewResult = async (s: PracticeSession) => {
    if (s.status !== "completed") return;
    try {
      const res = await fetch(`/api/practice/${s.id}`);
      const data = await res.json();
      setResultSession(data.session as PracticeSession);
      setView("result");
      navigateToResult(s.id);
    } catch {
      /* ignore */
    }
  };

  const handleAddToWrongBook = async (q: PracticeQuestion) => {
    setAddingWrongId(q.id);
    try {
      await fetch("/api/wrong-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: wrongSubject.current || createSubject,
          question: q.question,
          answer: q.correctAnswer,
          source: "practice",
          tags: [q.type],
        }),
      });
    } catch {
      /* ignore */
    } finally {
      setAddingWrongId(null);
    }
  };

  // ── Render ──
  // MAIN VIEW
  if (view === "main") {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">练习</h1>

          <SessionCreator
            subjects={subjects}
            createType={createType}
            createSubject={createSubject}
            createDuration={createDuration}
            creating={creating}
            onTypeChange={setCreateType}
            onSubjectChange={setCreateSubject}
            onDurationChange={setCreateDuration}
            onCreate={handleCreate}
          />

          {/* Advanced options */}
          {materials.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium"
              >
                ⚙️ 高级选项
                <span className={`transition-transform ${showOptions ? "rotate-180" : ""}`}>▼</span>
              </button>
              {showOptions && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">
                      关联学习资料（AI 会基于这些资料出题）
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {materials.map((m) => (
                        <label
                          key={m.id}
                          className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                            selectedMaterialIds.includes(m.id)
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "bg-white border-gray-200 text-gray-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMaterialIds.includes(m.id)}
                            onChange={() =>
                              setSelectedMaterialIds((prev) =>
                                prev.includes(m.id)
                                  ? prev.filter((id) => id !== m.id)
                                  : [...prev, m.id]
                              )
                            }
                            className="sr-only"
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                    {selectedMaterialIds.length > 0 && (
                      <button
                        onClick={() => setSelectedMaterialIds([])}
                        className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                      >
                        清除选择
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWrongQuestions}
                      onChange={(e) => setUseWrongQuestions(e.target.checked)}
                      className="rounded"
                    />
                    优先出薄弱知识点题目（从错题本分析）
                  </label>
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div>
            <h2 className="text-lg font-semibold mb-3">练习记录</h2>
            {loadingSessions ? (
              <p className="text-gray-500 text-sm">加载中...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">还没有练习记录</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleViewResult(s)}
                    className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">
                          {s.type === "daily" ? "📝 每日一练" : "⏱️ 模拟考试"}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">{s.subject}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.status === "completed" && s.totalScore != null && (
                          <span className="text-sm font-medium">
                            {s.totalScore}/{s.maxScore}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {s.status === "completed"
                            ? "✅ 已完成"
                            : s.status === "abandoned"
                            ? "⏹️ 已放弃"
                            : "🕐 进行中"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE VIEW
  if (view === "active" && session) {
    const questions = session.questions as PracticeQuestion[];
    return (
      <ActiveSession
        session={session}
        questions={questions}
        currentIndex={currentIndex}
        answers={answers}
        timeLeft={timeLeft}
        elapsedDisplay={elapsedDisplay}
        submitting={submitting}
        onAnswerChange={(qId, val) => setAnswers({ ...answers, [qId]: val })}
        onPrev={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
        onNext={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
        onSubmit={() => {
          if (session.type === "mock" && !confirm("确定提交试卷吗？提交后无法修改。")) return;
          handleSubmit();
        }}
        onBack={() => {
          setView("main");
          setSession(null);
          navigateToMain();
        }}
      />
    );
  }

  // RESULT VIEW
  if (view === "result" && resultSession) {
    return (
      <ResultView
        resultSession={resultSession}
        addingWrongId={addingWrongId}
        onAddToWrongBook={handleAddToWrongBook}
        onBack={() => {
          setView("main");
          setResultSession(null);
          navigateToMain();
        }}
        onRetry={() => {
          setCreateType(resultSession.type);
          setCreateSubject(resultSession.subject);
          setView("main");
          setResultSession(null);
          navigateToMain();
          setTimeout(() => handleCreate(), 100);
        }}
      />
    );
  }

  return null;
}
