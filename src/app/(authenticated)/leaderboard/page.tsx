'use client'

import { useCallback, useEffect, useState } from 'react'

type Period = 'week' | 'month' | 'all'
type Row = {
  rank: number
  userId: string
  duration: number
  days: number
  displayName: string
  isCurrentUser: boolean
}

const PERIOD_TABS: { id: Period; label: string }[] = [
  { id: 'week', label: '本周' },
  { id: 'month', label: '本月' },
  { id: 'all', label: '全部' },
]

const RANK_STYLE: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  2: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}
const RANK_ICON: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const formatDuration = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [rows, setRows] = useState<Row[]>([])
  const [callerRank, setCallerRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?period=${p}`)
      const data = await res.json()
      setRows(data.leaderboard ?? [])
      setCallerRank(data.callerRank ?? null)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period)
  }, [period, load])

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold tracking-tight">🏆 学习圈排行榜</h1>
        <div className="flex gap-1 p-1 rounded-2xl bg-muted">
          {PERIOD_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                period === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 我的排名 */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-500/20 p-4 text-center">
        {callerRank ? (
          <p className="text-sm">
            你当前排在第 <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{callerRank}</span> 名
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : (
          <p className="text-sm text-muted-foreground">这个周期还没有打卡记录，快来打卡上榜吧！</p>
        )}
      </div>

      {/* 领奖台 */}
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-2 items-end">
          {podium.map((r) => (
            <div
              key={r.userId}
              className={`rounded-2xl border p-4 text-center ${r.isCurrentUser ? 'border-brand/50 bg-brand-muted' : 'border-border/50 bg-card shadow-sm'}`}
              style={{ minHeight: `${r.rank === 1 ? 150 : r.rank === 2 ? 120 : 100}px` }}
            >
              <div className="text-2xl mb-1">{RANK_ICON[r.rank]}</div>
              <div className="font-semibold text-sm truncate px-1">
                {r.displayName}
                {r.isCurrentUser && <span className="ml-1 text-xs text-brand">(我)</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{formatDuration(r.duration)}</div>
              <div className="text-[11px] text-muted-foreground">{r.days} 天</div>
            </div>
          ))}
        </div>
      )}

      {/* 完整列表 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-10">加载中...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">🍃 还没有人上榜</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {[...podium, ...rest].map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 px-4 py-3 ${r.isCurrentUser ? 'bg-brand-muted/60' : ''}`}
              >
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                    r.rank <= 3 ? RANK_STYLE[r.rank] : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {r.rank}
                </span>
                <span className="flex-1 font-medium text-sm truncate">
                  {r.displayName}
                  {r.isCurrentUser && <span className="ml-1 text-xs text-brand font-semibold">(我)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{r.days} 天</span>
                <span className="text-sm font-semibold tabular-nums">{formatDuration(r.duration)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        按打卡累计时长排名，时长相同打卡天数多者靠前。坚持就是胜利 💪
      </p>
    </div>
  )
}
