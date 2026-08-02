'use client'

interface StatsCardsProps {
  todayTasks: { completed: number; total: number; minutes: number }
  weekStudy: { hours: number; days: number }
  streak: number
  completionRate: { rate: number; completed: number; total: number }
}

const items = [
  { key: 'today', icon: '📋', label: '今日任务', color: 'blue' as const },
  { key: 'week', icon: '⏱️', label: '本周学习', color: 'green' as const },
  { key: 'streak', icon: '🔥', label: '连续打卡', color: 'orange' as const },
  { key: 'rate', icon: '📊', label: '完成率', color: 'purple' as const },
]

export function StatsCards(p: StatsCardsProps) {
  const getValue = (key: string) => {
    switch (key) {
      case 'today': return { value: `${p.todayTasks.completed}/${p.todayTasks.total}`, sub: `${p.todayTasks.minutes} 分钟` }
      case 'week': return { value: `${p.weekStudy.hours.toFixed(1)}h`, sub: `打卡 ${p.weekStudy.days} 天` }
      case 'streak': return { value: `${p.streak} 天`, sub: p.streak >= 7 ? '太棒了！' : p.streak >= 3 ? '继续加油' : '从今天开始' }
      case 'rate': return { value: `${p.completionRate.rate}%`, sub: `${p.completionRate.completed}/${p.completionRate.total}` }
      default: return { value: '', sub: '' }
    }
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
