"use client";

import { useEffect, useRef, useState } from "react";

interface UsePracticeTimerOptions {
  isActive: boolean;
  isMock: boolean;        // mock 模式用倒计时, daily 模式用正计时
  initialDuration?: number; // mock 模式的初始分钟数
  onTimeUp?: () => void;   // mock 模式倒计时归零回调
}

interface UsePracticeTimerReturn {
  timeLeft: number | null;      // mock 模式: 剩余秒数; daily 模式: null
  elapsedDisplay: number;       // 每 5 秒更新一次，用于渲染
  reset: () => void;
}

/**
 * 练习页面定时器逻辑
 *
 * - mock 模式：倒计时，归零自动触发 onTimeUp
 * - daily 模式：正计时（elapsed），每 5 秒更新一次显示以减少 re-render
 */
export function usePracticeTimer({
  isActive,
  isMock,
  initialDuration = 180,
  onTimeUp,
}: UsePracticeTimerOptions): UsePracticeTimerReturn {
  const [timeLeft, setTimeLeft] = useState<number | null>(
    isMock ? initialDuration * 60 : null
  );
  const [elapsedDisplay, setElapsedDisplay] = useState(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    clearTimer();
    elapsedRef.current = 0;
    setElapsedDisplay(0);
    setTimeLeft(isMock ? initialDuration * 60 : null);
  };

  useEffect(() => {
    if (!isActive) {
      clearTimer();
      return;
    }

    if (isMock && timeLeft !== null) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t === null || t <= 1) {
            clearTimer();
            onTimeUp?.();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else if (!isMock) {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        if (elapsedRef.current % 5 === 0) {
          setElapsedDisplay(elapsedRef.current);
        }
      }, 1000);
    }

    return clearTimer;
  }, [isActive, isMock, timeLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  return { timeLeft, elapsedDisplay, reset };
}
