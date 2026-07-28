"use client";

import { Play, Pause, SkipForward, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TimerMode = "focus" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused";

interface PomodoroTimerProps {
  timeLeft: number;
  totalSeconds: number;
  mode: TimerMode;
  status: TimerStatus;
  completedFocusCount: number;
  longBreakInterval: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  onOpenSettings: () => void;
}

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 753.98

const modeConfig: Record<
  TimerMode,
  { label: string; ringColor: string; pillBg: string; pillText: string }
> = {
  focus: {
    label: "专注",
    ringColor: "text-red-500",
    pillBg: "bg-red-100 dark:bg-red-900/30",
    pillText: "text-red-600 dark:text-red-400",
  },
  short_break: {
    label: "短休息",
    ringColor: "text-green-500",
    pillBg: "bg-green-100 dark:bg-green-900/30",
    pillText: "text-green-600 dark:text-green-400",
  },
  long_break: {
    label: "长休息",
    ringColor: "text-blue-500",
    pillBg: "bg-blue-100 dark:bg-blue-900/30",
    pillText: "text-blue-600 dark:text-blue-400",
  },
};

import { formatTime } from "@/lib/time-utils";

export function PomodoroTimer({
  timeLeft,
  totalSeconds,
  mode,
  status,
  completedFocusCount,
  longBreakInterval,
  onStart,
  onPause,
  onReset,
  onSkip,
  onOpenSettings,
}: PomodoroTimerProps) {
  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const cfg = modeConfig[mode];

  const isRunning = status === "running";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Ring Timer */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72">
        <svg
          viewBox="0 0 280 280"
          className="w-full h-full -rotate-90"
        >
          {/* Background track */}
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress ring */}
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            className={`${cfg.ringColor} transition-[stroke-dashoffset] duration-300 ease-linear`}
          />
        </svg>

        {/* Center text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-4xl sm:text-5xl lg:text-6xl font-mono font-bold tabular-nums ${
              timeLeft <= 10 && mode === "focus" && isRunning
                ? "text-red-500 animate-pulse"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {formatTime(timeLeft)}
          </span>
          <span
            className={`text-xs sm:text-sm mt-1 px-2.5 py-0.5 rounded-full font-medium ${cfg.pillBg} ${cfg.pillText}`}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Session progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: longBreakInterval }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < completedFocusCount % longBreakInterval
                ? "bg-red-400 dark:bg-red-500"
                : (completedFocusCount > 0 &&
                    Math.floor((completedFocusCount - 1) / longBreakInterval) ===
                      Math.floor(completedFocusCount / longBreakInterval) &&
                    completedFocusCount % longBreakInterval === 0
                    ? i === 0
                    : i === completedFocusCount % longBreakInterval)
                  ? "bg-red-200 dark:bg-red-800 animate-pulse"
                  : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {completedFocusCount}
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2">
        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          aria-label="设置"
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* Reset */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          disabled={status === "idle" && timeLeft === totalSeconds}
          aria-label="重置"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* Play/Pause */}
        <Button
          variant="default"
          size="lg"
          onClick={isRunning ? onPause : onStart}
          className="min-w-[100px] h-12 text-base"
        >
          {isRunning ? (
            <>
              <Pause className="w-5 h-5 mr-1.5" />
              暂停
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-1.5" />
              {status === "paused" ? "继续" : "开始"}
            </>
          )}
        </Button>

        {/* Skip */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkip}
          disabled={status === "idle" && timeLeft === totalSeconds}
          aria-label="跳过"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
