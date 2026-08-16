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
import { usePracticeStore } from "@/stores/practice-store";
import { useUIStore } from "@/stores/ui-store";
import { confirmDialog } from "@/stores/confirm-store";
import { PageHeader } from "@/components/ui/page-header";
import { AiWaiting } from "@/components/ai-waiting";
import { useAiTask } from "@/hooks/use-ai-task";

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
  const [createMode, setCreateMode] = useState<"daily_review" | "spaced_review" | "mock_exam" | "custom" | "material_based" | "exam_questions">("daily_review");
  const [createType, setCreateType] = useState<"daily" | "mock">("daily");
  const [createSubject, setCreateSubject] = useState("");
  const [createCount, setCreateCount] = useState(10);
  const [createDuration, setCreateDuration] = useState(180);
  const [createDifficulty, setCreateDifficulty] = useState(0.5);
  const [includeMermaid, setIncludeMermaid] = useState(true);
  const [includeWeakPoints, setIncludeWeakPoints] = useState(true);

  // ── Mutations ──
  const createSessionMut = useCreatePracticeSession();
  const submitSessionMut = useSubmitPracticeSession();
  const creating = createSessionMut.isPending;
  const submitting = submitSessionMut.isPending;
  const genTask = useAiTask();

  // Active session
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // ── Sync to practice-store so ActivityBar/MobileNav can see ──
  const practiceStore = usePracticeStore;
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (session && view === "active") {
      wasActiveRef.current = true;
      practiceStore.getState().setActiveSession(session.id, session.subject, session.type as "daily" | "mock");
      practiceStore.getState().setIndex(currentIndex);
    } else if (view === "main" && creating) {
      practiceStore.getState().setGenerating(true, createMode);
    } else if (!session && !creating && wasActiveRef.current) {
      // 只有从 active 视图显式返回时才清除（不是首次加载）
      practiceStore.getState().clearSession();
      wasActiveRef.current = false;
    }
    // 首次加载时 view==="main" && !session && !creating → 不执行任何操作，保持持久化状态
  }, [session, view, currentIndex, creating, createMode]);

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
  const [addedWrongIds, setAddedWrongIds] = useState<Set<string>>(new Set());

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

  // ── Pre-fill from user defaults ──
  const uiDefaults = useUIStore((s) => s.practiceDefaults);
  const defaultsLoaded = useRef(false);
  useEffect(() => {
    if (defaultsLoaded.current) return;
    if (subjects.length > 0) {
      defaultsLoaded.current = true;
      setCreateSubject(subjects[0]);
      setCreateMode(uiDefaults.mode);
      setCreateCount(uiDefaults.count);
      setCreateDifficulty(uiDefaults.difficulty);
      setIncludeWeakPoints(uiDefaults.includeWeakPoints);
      if (uiDefaults.mode === "mock_exam") setCreateType("mock");
      else setCreateType("daily");
    }
  }, [subjects, uiDefaults]);

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

    genTask.start(); // 驱动生成等待的阶段文案/预估（mutation 本身不可中断，仅展示安抚）

    // Map mode to type
    const mappedType = createMode === "mock_exam" ? "mock" : "daily";

    createSessionMut.mutate(
      {
        type: mappedType,
        subject: createSubject,
        count: createCount,
        duration: createMode === "mock_exam" ? createDuration : undefined,
        materialIds: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        wrongQuestionIds: includeWeakPoints ? [] : undefined,
        generationMode: createMode,
        difficulty: createDifficulty,
        includeMermaid,
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
        onSettled: () => genTask.stop(),
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
    // 进行中的会话 → 恢复做题
    if (s.status === "in_progress") {
      try {
        const res = await fetch(`/api/practice/${s.id}`);
        const data = await res.json();
        const fullSession = data.session as PracticeSession;
        if (fullSession && fullSession.status === "in_progress") {
          setSession(fullSession);
          const savedAnswers = loadAnswers(fullSession.id);
          setAnswers(savedAnswers);
          setCurrentIndex(0);
          setView("active");
          wrongSubject.current = fullSession.subject;
          navigateToSession(fullSession.id);
          return;
        }
      } catch { /* ignore */ }
    }
    // 已完成的会话 → 查看结果
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
      const res = await fetch("/api/wrong-questions", {
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
      if (res.ok) {
        setAddedWrongIds((prev) => new Set(prev).add(q.id));
      }
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
        <div className="max-w-3xl mx-auto space-y-6">
          <PageHeader title="练习" />

          <SessionCreator
            subjects={subjects}
            todaySubjects={subjects.slice(0, 2)}
            dueWrongCount={0}
            mode={createMode}
            subject={createSubject}
            count={createCount}
            duration={createDuration}
            difficulty={createDifficulty}
            includeMermaid={includeMermaid}
            includeWeakPoints={includeWeakPoints}
            creating={creating}
            onModeChange={(m) => {
              setCreateMode(m);
              // Auto-set type based on mode
              setCreateType(m === "mock_exam" ? "mock" : "daily");
            }}
            onSubjectChange={setCreateSubject}
            onCountChange={setCreateCount}
            onDurationChange={setCreateDuration}
            onDifficultyChange={setCreateDifficulty}
            onIncludeMermaidChange={setIncludeMermaid}
            onIncludeWeakPointsChange={setIncludeWeakPoints}
            onCreate={handleCreate}
          />

          {/* AI 出题等待安抚：分阶段文案 + 预估（生成不可中断，仅安抚） */}
          {creating && (
            <div className="bg-card rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
              <AiWaiting phase={genTask.phase} estimate={genTask.estimate} variant="inline" />
            </div>
          )}

          {/* Material selection (shown for material_based mode or when materials exist) */}
          {materials.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 p-4">
              <label className="text-xs text-muted-foreground block mb-2">
                📎 关联学习资料（AI 基于这些出题）
              </label>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <label
                    key={m.id}
                    className={`text-xs px-3 py-1.5 rounded-full border border-border/50 cursor-pointer transition-colors ${
                      selectedMaterialIds.includes(m.id)
                        ? "bg-brand-muted border-brand/30 text-brand"
                        : "bg-card text-muted-foreground hover:bg-muted"
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
                  className="text-xs text-muted-foreground hover:text-foreground mt-2"
                >
                  清除选择
                </button>
              )}
            </div>
          )}

          {/* History */}
          <div>
            <h2 className="text-lg font-semibold mb-3">练习记录</h2>
            {loadingSessions ? (
              <p className="text-muted-foreground text-sm">加载中...</p>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">还没有练习记录</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleViewResult(s)}
                    className={`w-full text-left p-4 bg-card rounded-2xl border border-border/50 hover:shadow-sm transition-shadow ${
                      s.status === "in_progress" ? "border-brand/30 bg-brand-muted/50" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {s.type === "daily" ? "📝 每日一练" : "⏱️ 模拟考试"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{s.subject}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {s.status === "completed" && s.totalScore != null && (
                          <span className="text-sm font-medium">
                            {s.totalScore}/{s.maxScore}
                          </span>
                        )}
                        <span className={`text-xs ${
                          s.status === "in_progress" ? "text-brand font-medium" : "text-muted-foreground"
                        }`}>
                          {s.status === "completed"
                            ? "✅ 已完成"
                            : s.status === "abandoned"
                            ? "⏹️ 已放弃"
                            : "🕐 继续做题 →"}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
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
        onSubmit={async () => {
          if (session.type === "mock") {
            const ok = await confirmDialog({
              title: "提交试卷",
              message: "确定提交试卷吗？提交后无法修改。",
              confirmLabel: "提交",
            });
            if (!ok) return;
          }
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
        wrongCount={addedWrongIds.size}
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
