'use client'

interface StatsCardsProps {
  todayTasks: { completed: number; total: number; minutes: number }
  weekStudy: { hours: number; days: number }
  streak: number
  completionRate: { rate: number; completed: number; total: number }
}

export function StatsCards({
  todayTasks,
  weekStudy,
  streak,
  completionRate,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <StatCard
        icon="📋"
        label="今日任务"
        value={`${todayTasks.completed}/${todayTasks.total}`}
        sub={`${todayTasks.minutes} 分钟`}
        color="blue"
      />
      <StatCard
        icon="⏱️"
        label="本周学习"
        value={`${weekStudy.hours.toFixed(1)}h`}
        sub={`打卡 ${weekStudy.days} 天`}
        color="green"
      />
      <StatCard
        icon="🔥"
        label="连续打卡"
        value={`${streak} 天`}
        sub={streak >= 7 ? '太棒了！' : streak >= 3 ? '继续加油' : '从今天开始'}
        color="orange"
      />
      <StatCard
        icon="📊"
        label="任务完成率"
        value={`${completionRate.rate}%`}
        sub={`${completionRate.completed}/${completionRate.total}`}
        color="purple"
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string
  label: string
  value: string
  sub: string
  color: 'blue' | 'green' | 'orange' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className={`text-xl p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  )
}
