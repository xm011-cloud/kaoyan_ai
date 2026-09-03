'use client'

import Link from 'next/link'

interface PlanningOverviewCardProps {
  goal: { label: string; status: string } | null
  stage: { title: string; objective: string; exitCriteriaCount: number } | null
  weeklyPlan: {
    status: 'draft' | 'active' | 'none'
    objective: string | null
    plannedMinutes: number
    weekStart: string
  }
  today: { completed: number; total: number; nextTask: string | null }
}

const GOAL_STATUS_LABELS: Record<string, string> = {
  exploring: '探索中', tentative: '暂定', confirmed: '已确认', paused: '已暂停',
}

export function PlanningOverviewCard({ goal, stage, weeklyPlan, today }: PlanningOverviewCardProps) {
  const weekHref = `/tasks?week=${weeklyPlan.weekStart}`
  const items = [
    {
      key: 'goal',
      eyebrow: '长期目标',
      title: goal?.label || '尚未设置目标',
      detail: goal ? GOAL_STATUS_LABELS[goal.status] || goal.status : '先确定大致方向也可以开始',
      href: '/goal',
      action: goal ? '查看目标' : '开始设置',
      icon: '🎯',
    },
    {
      key: 'stage',
      eyebrow: '当前阶段',
      title: stage?.title || '尚未确认阶段路线',
      detail: stage ? `${stage.objective} · ${stage.exitCriteriaCount} 条退出标准` : '生成并确认长期学习路线',
      href: stage ? '/study-path#stage-adjustment' : '/study-path',
      action: stage ? '查看或调整阶段' : '建立路线',
      icon: '🗺️',
    },
    {
      key: 'week',
      eyebrow: '本周计划',
      title: weeklyPlan.status === 'draft' ? '有一份计划草稿待确认' : weeklyPlan.status === 'active' ? weeklyPlan.objective || '本周计划已生效' : '本周尚无正式计划',
      detail: weeklyPlan.status === 'none' ? '先从当前阶段切出一周行动' : `约 ${Math.round(weeklyPlan.plannedMinutes / 60)} 小时 · ${weeklyPlan.status === 'draft' ? '确认前不影响任务' : '正在执行'}`,
      href: weeklyPlan.status === 'draft' ? weekHref : `${weekHref}#weekly-plan-adjustment`,
      action: weeklyPlan.status === 'none' ? '生成周计划' : weeklyPlan.status === 'draft' ? '预览并确认' : '查看或调整本周',
      icon: '📅',
    },
    {
      key: 'today',
      eyebrow: '今日行动',
      title: today.nextTask || (today.total > 0 ? '今天的任务已经全部完成' : '今天还没有安排任务'),
      detail: `${today.completed}/${today.total} 已完成`,
      href: weekHref,
      action: today.total > 0 ? '查看今日任务' : '安排今天',
      icon: '✅',
    },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-5 py-4">
        <div>
          <h2 className="font-semibold">你的学习计划</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">目标决定方向，阶段定义成果，周计划安排容量，今天只负责行动。</p>
        </div>
        <Link href="/study-path" className="text-xs font-medium text-brand hover:underline">查看完整路线 →</Link>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group min-w-0 border-b border-border/40 p-4 transition-colors hover:bg-muted/50 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 xl:[&:nth-child(odd)]:border-r"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{item.icon}</span><span>{item.eyebrow}</span></div>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold">{item.title}</p>
            <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{item.detail}</p>
            <span className="mt-3 inline-flex text-xs font-medium text-brand group-hover:underline">{item.action} →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
