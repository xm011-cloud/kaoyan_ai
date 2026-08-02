'use client'

interface WeekBar {
  day: string
  minutes: number
  isToday: boolean
}

export function StudyTrendCard({ bars }: { bars: WeekBar[] }) {
  const weekMax = Math.max(...bars.map((b) => b.minutes), 60)
  const hasData = bars.some((b) => b.minutes > 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <h3 className="font-semibold mb-4">本周每日学习时长</h3>
      <div className="flex items-end justify-between gap-2 h-32">
        {bars.map((bar) => (
          <div key={bar.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">
              {bar.minutes > 0 ? `${Math.round(bar.minutes / 60)}h` : ''}
            </span>
            <div
              className={`w-full rounded-t-md transition-all ${
                bar.isToday ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-800'
              }`}
              style={{ height: `${Math.max(4, (bar.minutes / weekMax) * 100)}%` }}
            />
            <span
              className={`text-xs ${
                bar.isToday ? 'font-bold text-blue-600' : 'text-gray-400'
              }`}
            >
              {bar.day}
            </span>
          </div>
        ))}
      </div>
      {!hasData && (
        <p className="text-center text-sm text-gray-400 mt-2">这周还没有打卡数据</p>
      )}
    </div>
  )
}
