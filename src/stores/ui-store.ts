'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ──

export interface NavGroupItem {
  href: string
  visible: boolean
}

export interface NavGroup {
  id: string
  label: string
  icon: string
  visible: boolean
  items: NavGroupItem[]
}

export type PracticeMode = 'daily_review' | 'spaced_review' | 'mock_exam' | 'custom' | 'material_based'
export type PracticeUIMode = 'simple' | 'smart' | 'advanced'

export interface PracticeDefaults {
  mode: PracticeMode
  difficulty: number // 0.0 ~ 1.0
  count: number
  uiMode: PracticeUIMode
  includeWeakPoints: boolean
  includeSpacedReview: boolean
}

export interface UIState {
  // Navigation
  navGroups: NavGroup[]
  sidebarCollapsed: boolean

  // Workspace cards
  workspaceCards: string[] // ordered IDs of visible cards

  // Practice defaults
  practiceDefaults: PracticeDefaults

  // Actions
  setNavGroups: (groups: NavGroup[]) => void
  toggleGroup: (groupId: string) => void
  toggleNavItem: (groupId: string, href: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setWorkspaceCards: (cards: string[]) => void
  setPracticeDefaults: (defaults: Partial<PracticeDefaults>) => void
  resetNavToDefaults: () => void
  resetWorkspaceToDefaults: () => void
  resetPracticeToDefaults: () => void
}

// ── Defaults ──

export const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: '学习概览',
    icon: '📊',
    visible: true,
    items: [
      { href: '/dashboard', visible: true },
      { href: '/feedback', visible: true },
      { href: '/knowledge-graph', visible: true },
    ],
  },
  {
    id: 'daily',
    label: '今日学习',
    icon: '📝',
    visible: true,
    items: [
      { href: '/checkin', visible: true },
      { href: '/pomodoro', visible: true },
      { href: '/tasks', visible: true },
    ],
  },
  {
    id: 'practice',
    label: '练习备考',
    icon: '✏️',
    visible: true,
    items: [
      { href: '/practice', visible: true },
      { href: '/wrong-questions', visible: true },
      { href: '/admission', visible: false },
    ],
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: '📚',
    visible: true,
    items: [
      { href: '/materials', visible: true },
      { href: '/chat', visible: true },
      { href: '/study-path', visible: true },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    visible: true,
    items: [
      { href: '/goal', visible: true },
      { href: '/settings', visible: true },
    ],
  },
]

export const DEFAULT_WORKSPACE_CARDS = [
  'stats',
  'today-tasks',
  'quick-practice',
  'study-trend',
  'recent-materials',
  'wrong-overview',
  'spaced-review',
  'shortcuts',
]

export const DEFAULT_PRACTICE_DEFAULTS: PracticeDefaults = {
  mode: 'daily_review',
  difficulty: 0.5,
  count: 10,
  uiMode: 'smart',
  includeWeakPoints: true,
  includeSpacedReview: true,
}

// ── Store ──

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      navGroups: DEFAULT_NAV_GROUPS,
      sidebarCollapsed: false,
      workspaceCards: DEFAULT_WORKSPACE_CARDS,
      practiceDefaults: DEFAULT_PRACTICE_DEFAULTS,

      setNavGroups: (groups) => set({ navGroups: groups }),

      toggleGroup: (groupId) =>
        set((s) => ({
          navGroups: s.navGroups.map((g) =>
            g.id === groupId ? { ...g, visible: !g.visible } : g
          ),
        })),

      toggleNavItem: (groupId, href) =>
        set((s) => ({
          navGroups: s.navGroups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  items: g.items.map((i) =>
                    i.href === href ? { ...i, visible: !i.visible } : i
                  ),
                }
              : g
          ),
        })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setWorkspaceCards: (cards) => set({ workspaceCards: cards }),

      setPracticeDefaults: (defaults) =>
        set((s) => ({
          practiceDefaults: { ...s.practiceDefaults, ...defaults },
        })),

      resetNavToDefaults: () => set({ navGroups: DEFAULT_NAV_GROUPS }),
      resetWorkspaceToDefaults: () => set({ workspaceCards: DEFAULT_WORKSPACE_CARDS }),
      resetPracticeToDefaults: () => set({ practiceDefaults: DEFAULT_PRACTICE_DEFAULTS }),
    }),
    {
      name: 'ui-store',
    }
  )
)
