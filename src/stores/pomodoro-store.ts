'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PomodoroState {
  isRunning: boolean
  isPaused: boolean
  remainingSeconds: number
  totalSeconds: number
  sessionType: 'focus' | 'short_break' | 'long_break'
  completedSessions: number
  currentSubject?: string

  // Session metadata for DB recording
  startedAt: string | null     // ISO timestamp when this timer started
  plannedMinutes: number
  pendingComplete: boolean     // true = timer finished but DB save pending

  // Actions
  start: (type: PomodoroState['sessionType'], minutes: number, subject?: string) => void
  pause: () => void
  resume: () => void
  tick: () => void
  syncTime: (remainingSeconds: number, subject?: string) => void
  complete: () => void
  markSaved: () => void        // called after DB save succeeds
  reset: () => void
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      sessionType: 'focus',
      completedSessions: 0,
      currentSubject: undefined,
      startedAt: null,
      plannedMinutes: 25,
      pendingComplete: false,

      start: (type, minutes, subject) => {
        const { isRunning } = get()
        if (isRunning) {
          // Guard: don't silently overwrite. Caller should check or reset first.
          console.warn('PomodoroStore: already running, use reset() first')
          return
        }
        set({
          isRunning: true,
          isPaused: false,
          sessionType: type,
          totalSeconds: minutes * 60,
          remainingSeconds: minutes * 60,
          plannedMinutes: minutes,
          currentSubject: subject,
          startedAt: new Date().toISOString(),
          pendingComplete: false,
        })
      },

      pause: () => set({ isPaused: true }),
      resume: () => set({ isPaused: false }),

      tick: () => {
        const { isRunning, isPaused, remainingSeconds } = get()
        if (!isRunning || isPaused) return
        if (remainingSeconds <= 1) {
          get().complete()
          return
        }
        set({ remainingSeconds: remainingSeconds - 1 })
      },

      syncTime: (remainingSeconds, subject?) =>
        set((s) => ({
          remainingSeconds,
          ...(subject !== undefined ? { currentSubject: subject } : {}),
          isRunning: s.isRunning || true,
          startedAt: s.startedAt || new Date().toISOString(),
        })),

      complete: () =>
        set((s) => ({
          isRunning: false,
          isPaused: false,
          remainingSeconds: 0,
          completedSessions:
            s.sessionType === 'focus' ? s.completedSessions + 1 : s.completedSessions,
          pendingComplete: true,
        })),

      markSaved: () => set({ pendingComplete: false }),

      reset: () =>
        set({
          isRunning: false,
          isPaused: false,
          remainingSeconds: 0,
          totalSeconds: 0,
          sessionType: 'focus',
          currentSubject: undefined,
          startedAt: null,
          pendingComplete: false,
        }),
    }),
    {
      name: 'pomodoro-store',
      partialize: (state) => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        remainingSeconds: state.remainingSeconds,
        totalSeconds: state.totalSeconds,
        sessionType: state.sessionType,
        completedSessions: state.completedSessions,
        currentSubject: state.currentSubject,
        startedAt: state.startedAt,
        plannedMinutes: state.plannedMinutes,
        pendingComplete: state.pendingComplete,
      }),
    }
  )
)
