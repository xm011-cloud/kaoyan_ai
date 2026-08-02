'use client'

interface WeekBar { day: string; minutes: number; isToday: boolean }

export function StudyTrendCard({ bars }: { bars: WeekBar[] }) {
  const max = Math.max(...bars.map((b) => b.minutes), 60)
  const hasData = bars.some((b) => b.minutes > 0)

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold">📈 本周学习趋势</h3>
      </div>
      <div className="p-5">
        {!hasData ? (
          <div className="text-center py-6">
            <span className="text-3xl">📊</span>
            <p className="text-sm text-muted-foreground mt-2">这周还没有打卡</p>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1 h-28">
            {bars.map((b) => (
              <div key={b.day} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {b.minutes > 0 ? `${Math.round(b.minutes / 60)}h` : ''}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${b.isToday ? 'bg-brand' : 'bg-brand/20'}`}
                  style={{ height: `${Math.max(4, (b.minutes / max) * 100)}%` }}
                />
                <span className={`text-[11px] ${b.isToday ? 'font-bold text-brand' : 'text-muted-foreground'}`}>
                  {b.day}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
