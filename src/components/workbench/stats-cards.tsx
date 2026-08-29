'use client'

interface StatsCardsProps {
  todayTasks: { completed: number; total: number; minutes: number }
  weekStudy: { hours: number; days: number }
  completionRate: { rate: number; completed: number; total: number }
}

// 注：今日任务(完成/总数) 与 连续打卡 已在顶部 Banner 展示，这里不再重复；只留本周/完成率/今日时长
const items = [
  { key: 'week', icon: '⏱️', label: '本周学习', color: 'green' as const },
  { key: 'todayMinutes', icon: '📖', label: '今日时长', color: 'blue' as const },
  { key: 'rate', icon: '📊', label: '完成率', color: 'purple' as const },
]

export function StatsCards(p: StatsCardsProps) {
  const getValue = (key: string) => {
    switch (key) {
      case 'week': return { value: `${p.weekStudy.hours.toFixed(1)}h`, sub: `打卡 ${p.weekStudy.days} 天` }
      case 'todayMinutes': return { value: `${p.todayTasks.minutes} 分钟`, sub: p.todayTasks.minutes > 0 ? '今天学了这些' : '从今天开始' }
      case 'rate': return { value: `${p.completionRate.rate}%`, sub: `${p.completionRate.completed}/${p.completionRate.total}` }
      default: return { value: '', sub: '' }
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => {
        const { value, sub } = getValue(item.key)
        return (
          <div key={item.key} className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
                <p className="text-lg font-bold tracking-tight">{value}</p>
                <p className="text-[11px] text-muted-foreground/70">{sub}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
