'use client'

import Link from 'next/link'
import { useAiWorkspace } from '@/components/ai-workspace-context'

interface TodayCommandCenterProps {
  dateLabel: string
  goalLabel: string | null
  stageLabel: string
  stageHint: string
  daysLeft: number | null
  weeklyPlan: {
    status: 'draft' | 'active' | 'none'
    objective: string | null
    plannedMinutes: number
    weekStart: string
    milestoneTitle?: string | null
    milestoneReviewReady?: boolean
  }
  today: { completed: number; total: number; nextTask: { id: string; title: string; courseLessonId?: string | null } | null; minutes: number }
  dueWrongCount: number
}

const planStatusCopy = {
  draft: '本周计划待你确认',
  active: '本周正在推进',
  none: '还没有本周计划',
} as const

/**
 * 首页的唯一主叙事：长期方向 → 当前阶段 → 本周意图 → 眼前的一步。
 * 统计被降为上下文，避免仪表盘把学习者带回“看数据而非开始学习”的状态。
 */
export function TodayCommandCenter({
  dateLabel,
  goalLabel,
  stageLabel,
  stageHint,
  daysLeft,
  weeklyPlan,
  today,
  dueWrongCount,
}: TodayCommandCenterProps) {
  const aiWorkspace = useAiWorkspace()
  const hasTasks = today.total > 0
  const isFinished = hasTasks && today.completed === today.total
  const nextAction = isFinished
    ? '今天的计划已经完成'
    : today.nextTask?.title || (hasTasks ? '打开今天的任务，选择下一项开始' : '先为今天安排一个可完成的学习动作')
  const primaryHref = today.nextTask?.courseLessonId
    ? `/courses?lesson=${today.nextTask.courseLessonId}`
    : today.nextTask ? `/tasks?week=${weeklyPlan.weekStart}&task=${today.nextTask.id}` : weeklyPlan.status === 'none' ? '/tasks' : `/tasks?week=${weeklyPlan.weekStart}`
  const primaryLabel = isFinished ? '查看完成情况' : hasTasks ? '开始这一项' : weeklyPlan.status === 'none' ? '安排今天' : '查看本周计划'
  const weeklyHours = weeklyPlan.plannedMinutes > 0 ? `${Math.round(weeklyPlan.plannedMinutes / 60)} 小时` : '待安排'

  return (
    <section className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[0_18px_60px_-42px_rgb(15_23_42_/_0.38)]">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">{dateLabel}</p>
            {daysLeft != null && (
              <Link href="/goal" className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-brand-muted hover:text-brand">
                距目标 {daysLeft} 天
              </Link>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm text-muted-foreground">{goalLabel || '建立属于你的学习方向'}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-[32px] sm:leading-[1.18]">{stageLabel}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{stageHint}</p>
          </div>

          <div className="mt-7 border-y border-border/55 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">现在，只做下一步</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <p className="min-w-0 text-lg font-medium leading-7 tracking-[-0.02em] sm:text-xl">{nextAction}</p>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{today.completed}/{today.total} 已完成</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Link href={primaryHref} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition-transform hover:bg-brand/90 active:scale-[0.98]">
                {primaryLabel}
              </Link>
              <button
                type="button"
                onClick={() => aiWorkspace.requestHelp(`我正在执行今天的学习计划。下一步是「${nextAction}」。请结合我的阶段和本周目标，告诉我应如何开始；先给最小可执行的一步。`)}
                className="inline-flex min-h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand-muted/40 hover:text-brand"
              >
                让 AI 帮我开始
              </button>
              {dueWrongCount > 0 && (
                <Link href="/wrong-questions?dueToday=true" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30">
                  {dueWrongCount} 道错题待复习
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>今日计划 {today.minutes ? `${today.minutes} 分钟` : '未估时'}</span>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <Link href="/pomodoro" className="transition-colors hover:text-brand">进入专注模式</Link>
            <Link href="/checkin" className="transition-colors hover:text-brand">记录今天的状态</Link>
          </div>
        </div>

        <aside className="border-t border-border/60 bg-muted/25 px-5 py-5 lg:border-l lg:border-t-0 lg:px-6 lg:py-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">这周的方向</p>
          <p className="mt-3 text-base font-medium leading-6">{weeklyPlan.objective || '把学习节奏先稳定下来'}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{planStatusCopy[weeklyPlan.status]} · {weeklyHours}</p>
          {weeklyPlan.milestoneTitle && <p className="mt-3 text-xs font-medium text-brand">正在推进：{weeklyPlan.milestoneTitle}</p>}
          {weeklyPlan.milestoneReviewReady && <Link href="/study-path" className="mt-2 inline-flex text-xs font-medium text-success hover:underline">已积累足够证据，可以复盘确认 →</Link>}
          <Link href={`/tasks?week=${weeklyPlan.weekStart}`} className="mt-5 inline-flex text-sm font-medium text-brand hover:underline">查看周计划 →</Link>

          <div className="mt-8 space-y-3 border-t border-border/60 pt-5">
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">今日完成度</span><span className="font-medium tabular-nums">{today.total ? Math.round(today.completed / today.total * 100) : 0}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border/70"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${today.total ? Math.round(today.completed / today.total * 100) : 0}%` }} /></div>
          </div>
        </aside>
      </div>
    </section>
  )
}
