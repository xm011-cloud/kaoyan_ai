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

export type PracticeMode = 'daily_review' | 'spaced_review' | 'mock_exam' | 'custom' | 'material_based' | 'exam_questions'
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

  // Workspace cards
  workspaceCards: string[] // ordered IDs of visible cards

  // 工作区外壳偏好：只存客户端，避免把个人界面选择写进学习数据。
  workspaceSidebarCollapsed: boolean
  workspaceFocusMode: boolean
  aiWorkspaceOpen: boolean
  aiWorkspaceWidth: 'normal' | 'wide'

  // Practice defaults
  practiceDefaults: PracticeDefaults

  // AI 显示偏好
  showAiThinking: boolean // 是否展示 AI 思考过程折叠层（默认开）

  // 更新告示
  lastSeenChangelog: string | null // 已读的最新更新条目 id（null = 未读）

  // 新用户引导
  onboardingSeen: boolean // 首次引导弹窗是否已看（关闭后不再弹，卡片仍可显示）

  // Actions
  setNavGroups: (groups: NavGroup[]) => void
  toggleGroup: (groupId: string) => void
  toggleNavItem: (groupId: string, href: string) => void
  setWorkspaceCards: (cards: string[]) => void
  setWorkspaceSidebarCollapsed: (collapsed: boolean) => void
  toggleWorkspaceFocusMode: () => void
  setAiWorkspaceOpen: (open: boolean) => void
  toggleAiWorkspaceWidth: () => void
  setPracticeDefaults: (defaults: Partial<PracticeDefaults>) => void
  setShowAiThinking: (show: boolean) => void
  setLastSeenChangelog: (id: string | null) => void
  setOnboardingSeen: (seen: boolean) => void
  resetNavToDefaults: () => void
  resetWorkspaceToDefaults: () => void
  resetPracticeToDefaults: () => void
}

// ── Defaults ──

export const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    id: 'today',
    label: '今日',
    icon: '📅',
    visible: true,
    items: [
      { href: '/dashboard', visible: true },
      { href: '/checkin', visible: true },
      { href: '/pomodoro', visible: false },
      { href: '/leaderboard', visible: false },
    ],
  },
  {
    id: 'exam',
    label: '备考',
    icon: '📝',
    visible: true,
    items: [
      { href: '/goal', visible: true },
      { href: '/tasks', visible: true },
      { href: '/practice', visible: true },
      { href: '/wrong-questions', visible: true },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    visible: true,
    items: [
      { href: '/chat', visible: true },
      { href: '/feedback', visible: true },
      { href: '/study-path', visible: true },
    ],
  },
  {
    id: 'knowledge',
    label: '学习',
    icon: '📚',
    visible: true,
    items: [
      { href: '/courses', visible: true },
    ],
  },
  {
    id: 'tools',
    label: '更多工具',
    icon: '🧰',
    visible: true,
    items: [
      { href: '/tools', visible: true },
      { href: '/materials', visible: true },
      { href: '/pomodoro', visible: true },
      { href: '/skills', visible: true },
      { href: '/knowledge-graph', visible: true },
      { href: '/admission', visible: true },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    visible: true,
    items: [
      { href: '/settings', visible: true },
      { href: '/profile', visible: true },
      { href: '/changelog', visible: true },
    ],
  },
]

export const DEFAULT_WORKSPACE_CARDS = [
  'stats',
  'today-tasks',
  'continue-learning',
  'quick-practice',
  'study-trend',
  'recent-materials',
  'wrong-overview',
]

export const DEFAULT_PRACTICE_DEFAULTS: PracticeDefaults = {
  mode: 'daily_review',
  difficulty: 0.5,
  count: 10,
  uiMode: 'smart',
  includeWeakPoints: true,
  includeSpacedReview: true,
}

export const DEFAULT_SHOW_AI_THINKING = true

// ── Store ──

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      navGroups: DEFAULT_NAV_GROUPS,
      workspaceCards: DEFAULT_WORKSPACE_CARDS,
      workspaceSidebarCollapsed: false,
      workspaceFocusMode: false,
      aiWorkspaceOpen: false,
      aiWorkspaceWidth: 'normal',
      practiceDefaults: DEFAULT_PRACTICE_DEFAULTS,
      showAiThinking: DEFAULT_SHOW_AI_THINKING,
      lastSeenChangelog: null,
      onboardingSeen: false,

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

      setWorkspaceCards: (cards) => set({ workspaceCards: cards }),
      setWorkspaceSidebarCollapsed: (workspaceSidebarCollapsed) => set({ workspaceSidebarCollapsed }),
      toggleWorkspaceFocusMode: () => set((s) => ({ workspaceFocusMode: !s.workspaceFocusMode })),
      setAiWorkspaceOpen: (aiWorkspaceOpen) => set({ aiWorkspaceOpen }),
      toggleAiWorkspaceWidth: () => set((s) => ({ aiWorkspaceWidth: s.aiWorkspaceWidth === 'normal' ? 'wide' : 'normal' })),

      setPracticeDefaults: (defaults) =>
        set((s) => ({
          practiceDefaults: { ...s.practiceDefaults, ...defaults },
        })),

      setShowAiThinking: (show) => set({ showAiThinking: show }),

      setLastSeenChangelog: (id) => set({ lastSeenChangelog: id }),

      setOnboardingSeen: (seen) => set({ onboardingSeen: seen }),

      resetNavToDefaults: () => set({ navGroups: DEFAULT_NAV_GROUPS }),
      resetWorkspaceToDefaults: () => set({ workspaceCards: DEFAULT_WORKSPACE_CARDS }),
      resetPracticeToDefaults: () => set({ practiceDefaults: DEFAULT_PRACTICE_DEFAULTS }),
    }),
    {
      name: 'ui-store',
      version: 10,
      // 保留老存储里已有的偏好，只补新字段，避免升级清空用户的自定义
      migrate: (persistedState) => {
        const p = (persistedState ?? {}) as Partial<UIState>
        // 合并默认导航项：确保新增模块（如 /skills）在老用户的导航里出现，同时保留其可见性偏好
        const persistedNav = p.navGroups && p.navGroups.length > 0 ? p.navGroups : DEFAULT_NAV_GROUPS
        const navGroups = DEFAULT_NAV_GROUPS.map((dg) => {
          const existing = persistedNav.find((g) => g.id === dg.id)
          if (!existing) return dg
          const hrefs = new Set(existing.items.map((i) => i.href))
          return {
            ...existing,
            items: [...existing.items, ...dg.items.filter((di) => !hrefs.has(di.href))],
          }
        })
        // v10：收紧到学习主闭环。旧的院校/图谱/技能入口移入“更多工具”，
        // 排行榜暂停普通使用；只迁移导航偏好，不删除已有功能或用户数据。
        const today = navGroups.find((g) => g.id === 'today')
        if (today) {
          today.items = today.items.map((item) =>
            item.href === '/pomodoro' || item.href === '/leaderboard' ? { ...item, visible: false } : item
          )
        }
        // v7：计划总览曾是首页主链；v9 已收拢到顶部的 TodayCommandCenter，不再作为独立卡片。
        const persistedCards = p.workspaceCards && p.workspaceCards.length > 0
          ? p.workspaceCards
          : DEFAULT_WORKSPACE_CARDS
        const workspaceCards = persistedCards.filter((id) => id !== 'planning-overview')
        // v8：课程闭环进入首页，老用户获得一次“继续学习”入口，仍可自行隐藏/排序。
        const workspaceCardsWithLearning = workspaceCards.includes('continue-learning')
          ? workspaceCards
          : ['continue-learning', ...workspaceCards]
        return {
          navGroups,
          workspaceCards: workspaceCardsWithLearning,
          workspaceSidebarCollapsed: p.workspaceSidebarCollapsed ?? false,
          workspaceFocusMode: false,
          aiWorkspaceOpen: p.aiWorkspaceOpen ?? false,
          aiWorkspaceWidth: p.aiWorkspaceWidth ?? 'normal',
          practiceDefaults: p.practiceDefaults || DEFAULT_PRACTICE_DEFAULTS,
          showAiThinking: p.showAiThinking ?? DEFAULT_SHOW_AI_THINKING,
          lastSeenChangelog: p.lastSeenChangelog ?? null,
          onboardingSeen: p.onboardingSeen ?? false,
        }
      },
    }
  )
)
