'use client'

import { useUIStore, DEFAULT_WORKSPACE_CARDS } from '@/stores/ui-store'
import { StatsCards } from './stats-cards'
import { TodayTasksCard } from './today-tasks-card'
import { QuickPracticeCard } from './quick-practice-card'
import { StudyTrendCard } from './study-trend-card'
import { RecentMaterialsCard } from './recent-materials-card'
import { WrongOverviewCard } from './wrong-overview-card'
import { ShortcutsCard } from './shortcuts-card'

// ── Card definitions ──

interface CardDef {
  id: string
  title: string
  width: 'full' | 'half'
}

const cardDefs: Record<string, CardDef> = {
  stats: { id: 'stats', title: '统计卡片', width: 'full' },
  'today-tasks': { id: 'today-tasks', title: '今日任务', width: 'half' },
  'quick-practice': { id: 'quick-practice', title: '快速练习', width: 'full' },
  'study-trend': { id: 'study-trend', title: '学习趋势', width: 'half' },
  'recent-materials': { id: 'recent-materials', title: '最近资料', width: 'half' },
  'wrong-overview': { id: 'wrong-overview', title: '错题概览', width: 'half' },
  shortcuts: { id: 'shortcuts', title: '快捷入口', width: 'full' },
}

// ── Data types ──

interface WorkbenchData {
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
  recentChecks: Array<{
    id: string
    date: string
    duration: number
    status: string
  }>
}

// ── Component ──

export function WorkbenchGrid({ data }: { data: WorkbenchData }) {
  const workspaceCards = useUIStore((s) => s.workspaceCards)

  // Use stored order, fall back to defaults
  const ordered = workspaceCards.length > 0 ? workspaceCards : DEFAULT_WORKSPACE_CARDS

  const renderCard = (cardId: string) => {
    switch (cardId) {
      case 'stats':
        return <StatsCards key="stats" {...data.stats} />
      case 'today-tasks':
        return (
          <TodayTasksCard
            key="today-tasks"
            tasks={data.todayTasks}
            dateStr={data.dateStr}
          />
        )
      case 'quick-practice':
        return (
          <QuickPracticeCard
            key="quick-practice"
            subjects={data.subjects}
            todaySubjects={data.todaySubjects}
            dueWrongCount={data.dueWrongCount}
          />
        )
      case 'study-trend':
        return <StudyTrendCard key="study-trend" bars={data.weekBars} />
      case 'recent-materials':
        return (
          <RecentMaterialsCard key="recent-materials" materials={data.materials} />
        )
      case 'wrong-overview':
        return (
          <WrongOverviewCard
            key="wrong-overview"
            wrongQuestions={data.wrongQuestions}
            dueCount={data.dueWrongCount}
          />
        )
      case 'shortcuts':
        return <ShortcutsCard key="shortcuts" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 lg:p-6 text-white">
        <h1 className="text-lg lg:text-2xl font-bold">
          {data.goal
            ? `欢迎回来！目标：${data.goal.university} ${data.goal.major}`
            : '欢迎回来！'}
        </h1>
        <p className="mt-1 text-sm lg:text-base opacity-90">
          {data.goal
            ? `距考试还有 ${data.daysLeft} 天，加油 💪`
            : '先去设置考研目标，AI 为你生成专属计划'}
        </p>
      </div>

      {/* Ordered cards */}
      {ordered.map((cardId) => {
        const def = cardDefs[cardId]
        if (!def) return null
        return (
          <div key={cardId}>{renderCard(cardId)}</div>
        )
      })}
    </div>
  )
}
