'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PomodoroSession {
  type: 'focus' | 'short_break' | 'long_break'
  plannedMinutes: number
  startedAt: string // ISO
}

export interface PomodoroState {
  isRunning: boolean
  isPaused: boolean
  remainingSeconds: number
  totalSeconds: number
  sessionType: 'focus' | 'short_break' | 'long_break'
  completedSessions: number
  currentSubject?: string

  // Actions
  start: (type: PomodoroState['sessionType'], minutes: number, subject?: string) => void
  pause: () => void
  resume: () => void
  tick: () => void
  syncTime: (remainingSeconds: number, subject?: string) => void
  complete: () => void
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

      start: (type, minutes, subject) =>
        set({
          isRunning: true,
          isPaused: false,
          sessionType: type,
          totalSeconds: minutes * 60,
          remainingSeconds: minutes * 60,
          currentSubject: subject,
        }),

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
        })),

      complete: () =>
        set((s) => ({
          isRunning: false,
          isPaused: false,
          remainingSeconds: 0,
          completedSessions:
            s.sessionType === 'focus' ? s.completedSessions + 1 : s.completedSessions,
        })),

      reset: () =>
        set({
          isRunning: false,
          isPaused: false,
          remainingSeconds: 0,
          totalSeconds: 0,
          sessionType: 'focus',
          currentSubject: undefined,
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
      }),
    }
  )
)
