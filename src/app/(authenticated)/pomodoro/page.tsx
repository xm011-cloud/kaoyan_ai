"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PomodoroTimer, TimerMode, TimerStatus } from "@/components/pomodoro-timer";
import { PomodoroSettings } from "@/components/pomodoro-settings";
import { PomodoroHistory } from "@/components/pomodoro-history";

interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
}

// ── Utility ──
function notify(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Web Audio not supported
  }
}

function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

// ── sessionStorage persistence ──
const STORAGE_KEY = "pomodoro-timer-state";

interface PersistedTimerState {
  mode: TimerMode;
  status: "running" | "paused";
  timeLeft: number;
  completedFocusCount: number;
  startedAt: number;
  accumulated: number;
  totalSeconds: number;
  savedAt: number;
}

function saveTimerState(state: PersistedTimerState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable
  }
}

function loadTimerState(): PersistedTimerState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimerState;
  } catch {
    return null;
  }
}

function clearTimerState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function PomodoroPage() {
  // ── Settings state ──
  const [settings, setSettings] = useState<Settings>({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ── Timer state ──
  const [mode, setMode] = useState<TimerMode>("focus");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // ── History refresh key ──
  const [historyKey, setHistoryKey] = useState(0);

  // ── Refs for accurate timing ──
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const totalSecondsRef = useRef<number>(25 * 60);
  const modeRef = useRef<TimerMode>("focus");
  const restoredRef = useRef(false);

  // Keep mode ref in sync
  modeRef.current = mode;

  // ── Load settings & restore timer from sessionStorage ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/pomodoro/settings");
        const data = await res.json();
        const s: Settings = {
          focusMinutes: data.focusMinutes ?? 25,
          shortBreakMinutes: data.shortBreakMinutes ?? 5,
          longBreakMinutes: data.longBreakMinutes ?? 15,
          longBreakInterval: data.longBreakInterval ?? 4,
        };
        setSettings(s);

        // Try to restore timer state from sessionStorage
        const saved = loadTimerState();
        if (saved && !restoredRef.current) {
          restoredRef.current = true;
          setMode(saved.mode);
          setCompletedFocusCount(saved.completedFocusCount);
          totalSecondsRef.current = saved.totalSeconds;
          accumulatedRef.current = saved.accumulated;

          if (saved.status === "running") {
            // Calculate elapsed since save and adjust
            const elapsedSinceSave = Math.floor((Date.now() - saved.savedAt) / 1000);
            const totalElapsed = saved.accumulated + elapsedSinceSave;
            const remaining = Math.max(0, saved.totalSeconds - totalElapsed);

            if (remaining <= 0) {
              // Timer would have completed while away — just reset
              clearTimerState();
              const initial = s.focusMinutes * 60;
              setMode("focus");
              setStatus("idle");
              setTimeLeft(initial);
              totalSecondsRef.current = initial;
              accumulatedRef.current = 0;
            } else {
              setTimeLeft(remaining);
              accumulatedRef.current = saved.accumulated + elapsedSinceSave;
              startedAtRef.current = Date.now();
              setStatus("running");
            }
          } else {
            // Paused — restore exact timeLeft
            setTimeLeft(saved.timeLeft);
            setStatus("paused");
          }
        } else {
          // No saved state — normal init
          const initial = s.focusMinutes * 60;
          setTimeLeft(initial);
          totalSecondsRef.current = initial;
        }
      } catch {
        // use defaults
      } finally {
        setSettingsLoaded(true);
      }
    }
    load();
  }, []);

  // ── Calculate total seconds for mode ──
  const getTotalSecondsForMode = useCallback(
    (m: TimerMode) => {
      switch (m) {
        case "focus":
          return settings.focusMinutes * 60;
        case "short_break":
          return settings.shortBreakMinutes * 60;
        case "long_break":
          return settings.longBreakMinutes * 60;
      }
    },
    [settings]
  );

  // ── Save session to DB ──
  const saveSession = useCallback(
    async (
      sessionType: TimerMode,
      plannedMin: number,
      actualSec: number,
      sessionStatus: string,
      started: number,
      ended: number
    ) => {
      try {
        await fetch("/api/pomodoro/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: sessionType,
            plannedMinutes: plannedMin,
            actualSeconds: actualSec,
            status: sessionStatus,
            startedAt: new Date(started).toISOString(),
            endedAt: new Date(ended).toISOString(),
          }),
        });
        setHistoryKey((k) => k + 1);
      } catch {
        // silently ignore
      }
    },
    []
  );

  // ── Handle session completion ──
  const handleSessionComplete = useCallback(() => {
    const currentMode = modeRef.current;
    const totalSec = getTotalSecondsForMode(currentMode);
    const plannedMin = Math.ceil(totalSec / 60);
    const startedAt = startedAtRef.current - accumulatedRef.current * 1000;
    const endedAt = Date.now();

    // Save completed session
    saveSession(currentMode, plannedMin, totalSec, "completed", startedAt, endedAt);

    if (currentMode === "focus") {
      const newCount = completedFocusCount + 1;
      setCompletedFocusCount(newCount);
      notify("专注完成！🍅", "休息一下吧，你已经完成了一个番茄钟。");
      playBeep();

      // Determine next break type
      const isLongBreak = newCount % settings.longBreakInterval === 0;
      const nextMode: TimerMode = isLongBreak ? "long_break" : "short_break";
      const nextTotal = getTotalSecondsForMode(nextMode);

      setMode(nextMode);
      setStatus("running");
      setTimeLeft(nextTotal);
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      totalSecondsRef.current = nextTotal;

      // Persist the auto-started break
      saveTimerState({
        mode: nextMode,
        status: "running",
        timeLeft: nextTotal,
        completedFocusCount: newCount,
        startedAt: Date.now(),
        accumulated: 0,
        totalSeconds: nextTotal,
        savedAt: Date.now(),
      });
    } else {
      // Break completed → switch to focus, wait for user
      notify("休息结束！", "准备好开始下一个番茄钟了吗？");
      playBeep();

      const nextTotal = getTotalSecondsForMode("focus");
      setMode("focus");
      setStatus("idle");
      setTimeLeft(nextTotal);
      accumulatedRef.current = 0;
      totalSecondsRef.current = nextTotal;
      clearTimerState();
    }
  }, [
    completedFocusCount,
    settings.longBreakInterval,
    saveSession,
    getTotalSecondsForMode,
  ]);

  // ── Timer effect ──
  useEffect(() => {
    if (status !== "running") return;

    const intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const totalElapsed = accumulatedRef.current + elapsed;
      const total = totalSecondsRef.current;
      const remaining = Math.max(0, total - totalElapsed);

      setTimeLeft(remaining);

      // Persist to sessionStorage every tick
      saveTimerState({
        mode: modeRef.current,
        status: "running",
        timeLeft: remaining,
        completedFocusCount,
        startedAt: startedAtRef.current,
        accumulated: accumulatedRef.current,
        totalSeconds: total,
        savedAt: Date.now(),
      });

      if (remaining <= 0) {
        clearInterval(intervalId);
        clearTimerState();
        handleSessionComplete();
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [status, handleSessionComplete, completedFocusCount]);

  // ── Persist paused state on status change ──
  useEffect(() => {
    if (status === "idle") {
      clearTimerState();
    }
  }, [status]);

  // ── Controls ──
  const handleStart = useCallback(() => {
    requestNotificationPermission();

    if (status === "paused") {
      // Resume
      startedAtRef.current = Date.now();
      setStatus("running");
    } else {
      // Fresh start
      const total = getTotalSecondsForMode(mode);
      setTimeLeft(total);
      totalSecondsRef.current = total;
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      setStatus("running");
    }
  }, [status, mode, getTotalSecondsForMode]);

  const handlePause = useCallback(() => {
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
    accumulatedRef.current += elapsed;
    setStatus("paused");

    // Persist paused state
    saveTimerState({
      mode: modeRef.current,
      status: "paused",
      timeLeft: totalSecondsRef.current - accumulatedRef.current,
      completedFocusCount,
      startedAt: 0,
      accumulated: accumulatedRef.current,
      totalSeconds: totalSecondsRef.current,
      savedAt: Date.now(),
    });
  }, [completedFocusCount]);

  const handleReset = useCallback(() => {
    const total = getTotalSecondsForMode(mode);
    setStatus("idle");
    setTimeLeft(total);
    totalSecondsRef.current = total;
    accumulatedRef.current = 0;
    clearTimerState();
  }, [mode, getTotalSecondsForMode]);

  const handleSkip = useCallback(() => {
    const currentMode = modeRef.current;
    const total = getTotalSecondsForMode(currentMode);
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
    const totalElapsed = accumulatedRef.current + elapsed;
    const actualSec = Math.min(totalElapsed, total);
    const plannedMin = Math.ceil(total / 60);
    const startedAt =
      startedAtRef.current > 0
        ? startedAtRef.current - accumulatedRef.current * 1000
        : Date.now();

    if (currentMode === "focus" && actualSec > 0) {
      // Save interrupted focus session
      saveSession(
        currentMode,
        plannedMin,
        actualSec,
        "interrupted",
        startedAt,
        Date.now()
      );
    }

    // Determine next mode
    if (currentMode === "focus") {
      const newCount = completedFocusCount + 1;
      setCompletedFocusCount(newCount);
      const isLongBreak = newCount % settings.longBreakInterval === 0;
      const nextMode: TimerMode = isLongBreak ? "long_break" : "short_break";
      const nextTotal = getTotalSecondsForMode(nextMode);
      setMode(nextMode);
      setStatus("running");
      setTimeLeft(nextTotal);
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      totalSecondsRef.current = nextTotal;
    } else {
      // Skip break → go to focus
      const nextTotal = getTotalSecondsForMode("focus");
      setMode("focus");
      setStatus("idle");
      setTimeLeft(nextTotal);
      accumulatedRef.current = 0;
      totalSecondsRef.current = nextTotal;
    }
  }, [
    completedFocusCount,
    settings.longBreakInterval,
    saveSession,
    getTotalSecondsForMode,
  ]);

  const handleSaveSettings = useCallback(
    (newSettings: Settings) => {
      setSettings(newSettings);
      setShowSettings(false);

      // Recalculate current timer if idle and in focus mode
      if (mode === "focus" && status === "idle") {
        const total = newSettings.focusMinutes * 60;
        setTimeLeft(total);
        totalSecondsRef.current = total;
      }
    },
    [mode, status]
  );

  // ── Render ──
  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Page title */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">🍅 番茄钟</h1>
        <p className="text-sm text-gray-500 mt-1">
          专注 {settings.focusMinutes} 分钟 · 短休 {settings.shortBreakMinutes} 分钟
          · 长休 {settings.longBreakMinutes} 分钟
        </p>
      </div>

      {/* Timer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
        <PomodoroTimer
          timeLeft={timeLeft}
          totalSeconds={totalSecondsRef.current}
          mode={mode}
          status={status}
          completedFocusCount={completedFocusCount}
          longBreakInterval={settings.longBreakInterval}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onSkip={handleSkip}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Sub-text under timer */}
        {status === "idle" && (
          <p className="text-center text-sm text-gray-400 mt-4">
            点击「开始」进入{mode === "focus" ? "专注" : "休息"}模式
          </p>
        )}
        {status === "paused" && (
          <p className="text-center text-sm text-yellow-500 mt-4">已暂停</p>
        )}
        {status === "running" && mode === "focus" && (
          <p className="text-center text-sm text-red-400 mt-4 animate-pulse">
            专注中...
          </p>
        )}
        {status === "running" && mode !== "focus" && (
          <p className="text-center text-sm text-green-400 mt-4">
            休息中，放松一下
          </p>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <PomodoroSettings
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* History */}
      <PomodoroHistory key={historyKey} />
    </div>
  );
}
