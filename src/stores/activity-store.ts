'use client'

import { create } from 'zustand'

export interface Activity {
  id: string
  type: 'pomodoro' | 'practice' | 'ai_generation'
  title: string
  subtitle?: string
  icon: string
  status: 'running' | 'paused' | 'in_progress' | 'completed'
  linkTo?: string
  createdAt: number // timestamp for ordering
}

export interface ActivityState {
  activities: Activity[]

  register: (activity: Omit<Activity, 'createdAt'>) => void
  unregister: (id: string) => void
  updateStatus: (id: string, status: Activity['status'], subtitle?: string) => void
  updateTitle: (id: string, title: string, subtitle?: string) => void
  clearCompleted: () => void
}

export const useActivityStore = create<ActivityState>()((set) => ({
  activities: [],

  register: (activity) =>
    set((s) => {
      // Replace existing activity of same id
      const filtered = s.activities.filter((a) => a.id !== activity.id)
      return {
        activities: [
          ...filtered,
          { ...activity, createdAt: Date.now() },
        ].slice(-10), // Keep last 10
      }
    }),

  unregister: (id) =>
    set((s) => ({
      activities: s.activities.filter((a) => a.id !== id),
    })),

  updateStatus: (id, status, subtitle) =>
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id ? { ...a, status, ...(subtitle !== undefined ? { subtitle } : {}) } : a
      ),
    })),

  updateTitle: (id, title, subtitle) =>
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id ? { ...a, title, ...(subtitle !== undefined ? { subtitle } : {}) } : a
      ),
    })),

  clearCompleted: () =>
    set((s) => ({
      activities: s.activities.filter((a) => a.status !== 'completed'),
    })),
}))
