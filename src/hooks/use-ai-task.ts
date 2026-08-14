"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 等待安抚状态机（分阶段文案轮播 + 已等待时长 + 预估秒数 + 可取消）
// 设计定稿（product-design-principles「等待安抚」）：等待 = 分阶段状态机 + 预估秒数 + 可取消
// 等待焦虑 = 不知道等多久 + 不知道在等什么 + 感觉被困住；取消按钮 = 可逆性，减半焦虑
//
// 用法：
//   const task = useAiTask()
//   const controller = task.start()                 // 返回 AbortController，把 signal 传给 fetch
//   fetch(url, { signal: controller.signal })
//   // 等待气泡读 task.phase / task.estimate，取消按钮调 task.cancel()
//   // 请求结束（finally）调 task.stop()
//
// 前端时间驱动（非流式第一层）：不承诺精确阶段，只给"进展感 + 可退出"。

export interface AiWaitPhase {
  label: string;
  detail: string;
}

// 阶段文案轮播：随时间切换，让用户"知道在等什么"。
// start = 该阶段开始的毫秒（0 = 一开始就显示），取"已越过的最后一个 start"为当前阶段。
const PHASE_DEFS: Array<{ start: number; label: string; detail: string }> = [
  { start: 0, label: "正在连接 AI", detail: "建立安全连接…" },
  { start: 2500, label: "正在理解你的情况", detail: "读取学习数据…" },
  { start: 8000, label: "正在深度思考", detail: "推理与查证…" },
  { start: 16000, label: "正在生成内容", detail: "组织语言，快好了…" },
  { start: 30000, label: "处理时间较长", detail: "可随时取消后重试…" },
];

// 预估秒数：基于已等待时长给渐进预期，越等越坦诚
function estimateLabel(elapsed: number): string {
  const s = Math.round(elapsed / 1000);
  if (elapsed < 4000) return "通常需要 10~30 秒";
  if (elapsed < 15000) return `已等待 ${s} 秒，预计还需一点时间`;
  if (elapsed < 30000) return `已等待 ${s} 秒，快好了`;
  return `已等待 ${s} 秒，可取消后重试`;
}

export function useAiTask() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // 防御：丢弃上一次可能仍挂起的请求
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    startAtRef.current = Date.now();
    setElapsed(0);
    setPhaseIndex(0);
    setRunning(true);
    clearTimer();
    timerRef.current = setInterval(() => {
      const e = Date.now() - startAtRef.current;
      setElapsed(e);
      for (let i = PHASE_DEFS.length - 1; i >= 0; i--) {
        if (e >= PHASE_DEFS[i].start) {
          setPhaseIndex(i);
          break;
        }
      }
    }, 400);
    return controller;
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    controllerRef.current = null;
    setRunning(false);
  }, [clearTimer]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    clearTimer();
    controllerRef.current = null;
    setRunning(false);
  }, [clearTimer]);

  // 卸载时清理计时器
  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    running,
    elapsed,
    phaseIndex,
    phase: PHASE_DEFS[phaseIndex],
    estimate: estimateLabel(elapsed),
    start,
    stop,
    cancel,
  };
}
