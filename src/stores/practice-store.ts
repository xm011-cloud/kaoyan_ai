'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PracticeState {
  // Active session
  activeSessionId?: string
  activeSubject?: string
  activeType?: 'daily' | 'mock'
  currentIndex: number
  answers: Record<string, string>

  // Pending generation (AI is working)
  isGenerating: boolean
  generationMode?: 'daily_review' | 'spaced_review' | 'mock_exam' | 'custom' | 'material_based'

  // Actions
  setActiveSession: (sessionId: string, subject: string, type: 'daily' | 'mock') => void
  updateAnswer: (questionId: string, answer: string) => void
  setIndex: (index: number) => void
  setGenerating: (generating: boolean, mode?: PracticeState['generationMode']) => void
  clearSession: () => void
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      activeSessionId: undefined,
      activeSubject: undefined,
      activeType: undefined,
      currentIndex: 0,
      answers: {},
      isGenerating: false,
      generationMode: undefined,

      setActiveSession: (sessionId, subject, type) =>
        set({
          activeSessionId: sessionId,
          activeSubject: subject,
          activeType: type,
          currentIndex: 0,
          answers: {},
        }),

      updateAnswer: (questionId, answer) =>
        set((s) => ({
          answers: { ...s.answers, [questionId]: answer },
        })),

      setIndex: (index) => set({ currentIndex: index }),

      setGenerating: (generating, mode) =>
        set({ isGenerating: generating, generationMode: generating ? mode : undefined }),

      clearSession: () =>
        set({
          activeSessionId: undefined,
          activeSubject: undefined,
          activeType: undefined,
          currentIndex: 0,
          answers: {},
          isGenerating: false,
          generationMode: undefined,
        }),
    }),
    {
      name: 'practice-store',
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        activeSubject: state.activeSubject,
        activeType: state.activeType,
        currentIndex: state.currentIndex,
        answers: state.answers,
        isGenerating: state.isGenerating,
        generationMode: state.generationMode,
      }),
    }
  )
)
