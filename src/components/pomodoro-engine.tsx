'use client'

import { useEffect, useRef } from 'react'
import { usePomodoroStore } from '@/stores/pomodoro-store'

/**
 * 全局计时引擎 — 挂载在 Shell 层，永不卸载
 *
 * 每 1 秒 tick store，确保：
 * - 离开番茄钟页后倒数继续
 * - Header/ActivityBar/MobileNav 读到的 remainingSeconds 实时更新
 */
export function PomodoroEngine() {
  const tickRef = useRef<(() => void) | null>(null)

  // Keep a stable ref to the tick function (avoids re-subscribing interval)
  useEffect(() => {
    tickRef.current = () => {
      const state = usePomodoroStore.getState()
      if (state.isRunning && !state.isPaused) {
        usePomodoroStore.getState().tick()
      }
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current?.()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return null // invisible
}
