'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 用户激活漏斗（管理后台 · 阶段 0 决策依据，ADR 3.4）。
 * 客户端组件：挂载时拉 /api/admin/funnel，渲染阶段转化率 + 单用户轨迹。
 * 「点开一个卡住的用户」→ 展开行看各环节首触时间。
 */

type FunnelReport = {
  computedAt: string
  totalUsers: number
  stages: {
    id: string
    label: string
    description: string
    reached: number
    total: number
    rate: number
    prevReached: number
  }[]
  users: {
    id: string
    email: string
    createdAt: string
    lastActivityAt: string | null
    returnEligible: boolean
    reached: string[]
    firstAt: Record<string, string | null>
  }[]
}

function formatDT(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STAGE_IDS = ['registered', 'goal', 'plan', 'checkin', 'ai', 'deep', 'return7']
const STAGE_SHORT = ['注册', '目标', '计划', '打卡', 'AI', '深', '7日']

export default function FunnelView() {
  const [data, setData] = useState<FunnelReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // 首次挂载拉取（只在异步回调里 setState，避免级联渲染 lint）
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/funnel')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d: FunnelReport) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/funnel')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setRefreshing(false)
    }
  }

  if (!data && !error) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-8 text-center text-sm text-muted-foreground">
        正在聚合用户激活数据…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-8 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={refresh}>
          重试
        </Button>
      </div>
    )
  }

  if (!data) return null

  const users = [...data.users].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <p className="text-sm font-semibold">用户激活漏斗</p>
            <p className="text-xs text-muted-foreground">
              共 {data.totalUsers} 位用户 · 计算于 {formatDT(data.computedAt)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={refresh} disabled={refreshing}>
          {refreshing ? '刷新中…' : '🔄 刷新'}
        </Button>
      </div>

      {/* 阶段转化率 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold">阶段转化率</p>
        {data.stages.map((s, i) => {
          const pct = Math.round(s.rate * 100)
          const loss = i > 0 ? s.prevReached - s.reached : 0
          const sampleNote = s.total !== data.totalUsers ? `（样本 ${s.total} 人）` : ''
          return (
            <div key={s.id}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground whitespace-nowrap">{s.label}</span>
                  <span className="text-muted-foreground truncate" title={s.description}>
                    {s.description}
                  </span>
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {s.reached}/{s.total} · <span className="font-semibold text-foreground">{pct}%</span>
                  {sampleNote}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${i === 0 ? 'bg-gradient-to-r from-brand to-brand/70' : 'bg-gradient-to-r from-brand/80 to-brand/40'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {loss > 0 && (
                <p className="mt-1 text-[11px] text-red-400">
                  ↓ 与上一阶段比流失 {loss} 人
                </p>
              )}
            </div>
          )
        })}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          7 日回访只统计注册满 7 天的用户；「配 AI」= 设置页填了自己的 Key（无精确时间）。深功能 = 练习 / 错题本 / 技能运行 / 学习路径。
        </p>
      </div>

      {/* 单用户轨迹 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">单用户轨迹</p>
          <span className="text-xs text-muted-foreground">点开一个卡住的用户看使用痕迹</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                <th className="py-2 pr-3 font-medium">用户</th>
                <th className="py-2 pr-3 font-medium">注册</th>
                {STAGE_IDS.map((id, idx) => (
                  <th key={id} className="py-2 pr-2 text-center font-medium" title={data.stages[idx]?.description}>
                    {STAGE_SHORT[idx]}
                  </th>
                ))}
                <th className="py-2 pl-2 font-medium text-right">最近行为</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} u={u} expanded={expanded === u.id} onToggle={() => setExpanded(expanded === u.id ? null : u.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserRow({
  u,
  expanded,
  onToggle,
}: {
  u: FunnelReport['users'][number]
  expanded: boolean
  onToggle: () => void
}) {
  const reachedCount = u.reached.length
  const stuck = reachedCount < 4
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border/40 hover:bg-muted/40 transition-colors"
      >
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate max-w-[200px]">{u.email}</span>
            {stuck && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">卡住?</span>}
          </div>
        </td>
        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground text-xs">{formatDT(u.createdAt)}</td>
        {STAGE_IDS.map((id) => {
          const hit = u.reached.includes(id)
          const ts = u.firstAt[id]
          const pending = id === 'return7' && !u.returnEligible
          return (
            <td key={id} className="py-2 pr-2 text-center" title={hit ? `到达于 ${formatDT(ts)}` : pending ? '注册未满 7 天' : '未到达'}>
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  hit
                    ? 'bg-brand/15 text-brand'
                    : pending
                      ? 'bg-muted text-muted-foreground/40'
                      : 'bg-muted text-muted-foreground/40'
                }`}
              >
                {hit ? '✓' : '·'}
              </span>
            </td>
          )
        })}
        <td className="py-2 pl-2 whitespace-nowrap text-xs text-muted-foreground text-right">{formatDT(u.lastActivityAt)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/40 bg-muted/20">
          <td colSpan={STAGE_IDS.length + 3} className="py-3 px-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {dataStages(u).map(({ id, label, ts }) => (
                <div key={id} className="rounded-lg bg-card border border-border/40 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium mt-0.5">{ts}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function dataStages(u: FunnelReport['users'][number]) {
  return [
    { id: 'registered', label: '注册', ts: formatDT(u.createdAt) },
    { id: 'goal', label: '设目标', ts: formatDT(u.firstAt.goal ?? null) },
    { id: 'plan', label: '生成计划', ts: formatDT(u.firstAt.plan ?? null) },
    { id: 'checkin', label: '首次打卡', ts: formatDT(u.firstAt.checkin ?? null) },
    { id: 'ai', label: '配 AI', ts: u.firstAt.ai === null && u.reached.includes('ai') ? '✓ 已配置' : '—' },
    { id: 'deep', label: '深功能', ts: formatDT(u.firstAt.deep ?? null) },
    { id: 'return7', label: '7 日回访', ts: u.returnEligible ? formatDT(u.firstAt.return7 ?? null) : '注册未满 7 天' },
  ]
}
