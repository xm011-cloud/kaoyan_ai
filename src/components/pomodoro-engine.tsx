'use client'

import { useEffect, useRef } from 'react'
import { usePomodoroStore } from '@/stores/pomodoro-store'

/**
 * 全局计时 + 后台自动保存引擎
 *
 * 职责:
 * 1. 每 1s tick store — 离开番茄钟页后倒数继续
 * 2. 计时器到期时 → 保存 session 到数据库（即使不在番茄钟页）
 */

async function saveSessionToDb(state: ReturnType<typeof usePomodoroStore.getState>) {
  try {
    const startedAt = state.startedAt
      ? new Date(state.startedAt).toISOString()
      : new Date(Date.now() - state.plannedMinutes * 60 * 1000).toISOString()

    await fetch('/api/pomodoro/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: state.sessionType,
        plannedMinutes: state.plannedMinutes,
        actualSeconds: state.plannedMinutes * 60, // full session = completed
        status: 'completed',
        startedAt,
        endedAt: new Date().toISOString(),
      }),
    })
  } catch {
    // Silently fail — will retry on next page load or manual complete
  }
}

export function PomodoroEngine() {
  const tickRef = useRef<(() => void) | null>(null)
  const lastPendingRef = useRef(false)

  useEffect(() => {
    tickRef.current = () => {
      const state = usePomodoroStore.getState()
      if (state.isRunning && !state.isPaused) {
        usePomodoroStore.getState().tick()
      }

      // Detect completion: pendingComplete was false → true
      const newState = usePomodoroStore.getState()
      if (newState.pendingComplete && !lastPendingRef.current) {
        lastPendingRef.current = true
        saveSessionToDb(newState).then(() => {
          usePomodoroStore.getState().markSaved()
          lastPendingRef.current = false
        })
      }

      // Reset tracking if pendingComplete is cleared elsewhere
      if (!newState.pendingComplete) {
        lastPendingRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current?.()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return null
}
