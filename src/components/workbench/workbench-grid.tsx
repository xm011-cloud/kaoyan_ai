'use client'

import type { ReactNode } from 'react'
import { useUIStore, DEFAULT_WORKSPACE_CARDS } from '@/stores/ui-store'
import { StatsCards } from './stats-cards'
import { TodayTasksCard } from './today-tasks-card'
import { QuickPracticeCard } from './quick-practice-card'
import { StudyTrendCard } from './study-trend-card'
import { RecentMaterialsCard } from './recent-materials-card'
import { WrongOverviewCard } from './wrong-overview-card'
import { ShortcutsCard } from './shortcuts-card'

/**
 * 工作台卡片单一注册表（DIY/插件化的地基）：
 * 新增一张卡片 = 在这里加一条，settings 的 label 自动复用（WORKBENCH_CARD_LABELS）。
 */
const CARD_REGISTRY: Record<string, { label: string; layout: 'full' | 'half'; render: (data: WorkbenchData) => ReactNode }> = {
  stats: { label: '📊 统计', layout: 'full', render: (d) => <StatsCards {...d.stats} /> },
  'today-tasks': { label: '📋 任务', layout: 'half', render: (d) => <TodayTasksCard tasks={d.todayTasks} dateStr={d.dateStr} /> },
  'quick-practice': { label: '✏️ 练习', layout: 'full', render: (d) => <QuickPracticeCard subjects={d.subjects} todaySubjects={d.todaySubjects} dueWrongCount={d.dueWrongCount} /> },
  'study-trend': { label: '📈 趋势', layout: 'half', render: (d) => <StudyTrendCard bars={d.weekBars} /> },
  'recent-materials': { label: '📚 资料', layout: 'half', render: (d) => <RecentMaterialsCard materials={d.materials} /> },
  'wrong-overview': { label: '🔴 错题', layout: 'half', render: (d) => <WrongOverviewCard wrongQuestions={d.wrongQuestions} dueCount={d.dueWrongCount} /> },
  shortcuts: { label: '🔗 快捷', layout: 'full', render: () => <ShortcutsCard /> },
}

/** 供 settings「界面定制」引用，避免卡片 label 第四处硬编码 */
export const WORKBENCH_CARD_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CARD_REGISTRY).map(([id, c]) => [id, c.label])
)

export interface WorkbenchData {
  stats: {
    todayTasks: { completed: number; total: number; minutes: number }
    weekStudy: { hours: number; days: number }
    streak: number
    completionRate: { rate: number; completed: number; total: number }
  }
  todayTasks: Array<{
    id: string
    title: string
    completed: boolean
    duration?: number | null
    phase?: string | null
  }>
  dateStr: string
  subjects: string[]
  todaySubjects: string[]
  dueWrongCount: number
  weekBars: Array<{ day: string; minutes: number; isToday: boolean }>
  materials: Array<{
    id: string
    name: string
    type: string
    createdAt: string
  }>
  wrongQuestions: Array<{
    id: string
    question: string
    subject: string
    interval: number
    nextReviewDate: string | null
  }>
  goal: { university: string; major: string } | null
  daysLeft: number
  reentry: { show: boolean; daysSinceLastCheckin: number | null }
}

export function WorkbenchGrid({ data }: { data: WorkbenchData }) {
  const workspaceCards = useUIStore((s) => s.workspaceCards)
  const ordered = workspaceCards.length > 0 ? workspaceCards : DEFAULT_WORKSPACE_CARDS
  const fullCards = ordered.filter((id) => CARD_REGISTRY[id]?.layout === 'full')
  const halfCards = ordered.filter((id) => CARD_REGISTRY[id]?.layout === 'half')

  const renderCard = (cardId: string) => {
    const entry = CARD_REGISTRY[cardId]
    return entry ? <div key={cardId}>{entry.render(data)}</div> : null
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Hero banner — elevated card with gradient */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-primary/80 p-5 lg:p-7 text-white shadow-lg shadow-brand/20">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
          {data.goal ? `欢迎回来 ✨` : '欢迎来到考研助手 🎓'}
        </h1>
        <p className="mt-1.5 text-sm lg:text-base text-white/80">
          {data.goal
            ? `${data.goal.university} · ${data.goal.major}  ·  距考试 ${data.daysLeft} 天`
            : '设置考研目标，AI 为你生成专属备考计划'}
        </p>
        {!data.goal && (
          <a href="/goal" className="inline-block mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors">
            🎯 去设置目标 →
          </a>
        )}
      </div>

      {/* 温柔重入卡：今日未打卡 + 距上次打卡 > 3 天时出现（不指责、从今天开始） */}
      {data.reentry.show && (
        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-900/10 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              不用补卡，从今天开始就好
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.reentry.daysSinceLastCheckin
                ? `上次打卡已是 ${data.reentry.daysSinceLastCheckin} 天前，哪怕只学 10 分钟也是重新上路。`
                : '哪怕只学 10 分钟也是重新上路。'}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/pomodoro"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>🍅</span>
              <span>先来一个 10 分钟</span>
            </a>
            <a
              href="/checkin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>✅</span>
              <span>去打卡</span>
            </a>
          </div>
        </div>
      )}

      {/* Card grid — full-width cards stack, half-width go 2-col on lg+ */}
      <div className="space-y-5">
        {fullCards.map(renderCard)}

        {/* 2-column row for half-width cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {halfCards.map(renderCard)}
        </div>
      </div>
    </div>
  )
}
