'use client'

import { useUIStore, DEFAULT_WORKSPACE_CARDS } from '@/stores/ui-store'
import { StatsCards } from './stats-cards'
import { TodayTasksCard } from './today-tasks-card'
import { QuickPracticeCard } from './quick-practice-card'
import { StudyTrendCard } from './study-trend-card'
import { RecentMaterialsCard } from './recent-materials-card'
import { WrongOverviewCard } from './wrong-overview-card'
import { ShortcutsCard } from './shortcuts-card'

// ── Layout defines which cards go full-width vs 2-col ──
const CARD_LAYOUT: Record<string, 'full' | 'half'> = {
  stats: 'full',
  'today-tasks': 'half',
  'quick-practice': 'full',
  'study-trend': 'half',
  'recent-materials': 'half',
  'wrong-overview': 'half',
  shortcuts: 'full',
}

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

  const renderCard = (cardId: string) => {
    switch (cardId) {
      case 'stats':
        return <StatsCards key="stats" {...data.stats} />
      case 'today-tasks':
        return <TodayTasksCard key="today-tasks" tasks={data.todayTasks} dateStr={data.dateStr} />
      case 'quick-practice':
        return <QuickPracticeCard key="quick-practice" subjects={data.subjects} todaySubjects={data.todaySubjects} dueWrongCount={data.dueWrongCount} />
      case 'study-trend':
        return <StudyTrendCard key="study-trend" bars={data.weekBars} />
      case 'recent-materials':
        return <RecentMaterialsCard key="recent-materials" materials={data.materials} />
      case 'wrong-overview':
        return <WrongOverviewCard key="wrong-overview" wrongQuestions={data.wrongQuestions} dueCount={data.dueWrongCount} />
      case 'shortcuts':
        return <ShortcutsCard key="shortcuts" />
      default:
        return null
    }
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
        {ordered.map((cardId) => {
          const layout = CARD_LAYOUT[cardId] || 'full'
          if (layout === 'full') {
            return <div key={cardId}>{renderCard(cardId)}</div>
          }
          return null
        })}

        {/* 2-column row for half-width cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {ordered
            .filter((id) => CARD_LAYOUT[id] === 'half')
            .map((cardId) => (
              <div key={cardId}>{renderCard(cardId)}</div>
            ))}
        </div>
      </div>
    </div>
  )
}
