'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type ClosureHealthReport = {
  computedAt: string
  learnerCount: number
  completeEvidenceUsers: number
  stages: {
    id: string
    label: string
    description: string
    reached: number
    total: number
    rate: number
    gapFromPrevious: number | null
  }[]
}

function formatDT(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function ClosureHealthView() {
  const [data, setData] = useState<ClosureHealthReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const response = await fetch('/api/admin/closure-health')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<ClosureHealthReport>
  }

  useEffect(() => {
    let cancelled = false
    load()
      .then((report) => { if (!cancelled) setData(report) })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败') })
    return () => { cancelled = true }
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      setData(await load())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载失败')
    } finally {
      setRefreshing(false)
    }
  }

  if (!data && !error) return <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">正在汇总学习闭环证据…</div>
  if (error && !data) return <div className="rounded-2xl border border-border/50 bg-card p-8 text-center"><p className="text-sm text-red-500">{error}</p><Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={refresh}>重试</Button></div>
  if (!data) return null

  const largestGap = [...data.stages]
    .filter((stage) => stage.gapFromPrevious !== null)
    .sort((a, b) => (b.gapFromPrevious ?? 0) - (a.gapFromPrevious ?? 0))[0]

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold">学习闭环健康度</p>
        <p className="text-xs text-muted-foreground">{data.learnerCount} 位有任务用户 · 计算于 {formatDT(data.computedAt)}</p>
      </div>
      <Button variant="outline" size="sm" className="rounded-full" onClick={refresh} disabled={refreshing}>{refreshing ? '刷新中…' : '刷新'}</Button>
    </div>

    <section className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/55 p-4"><p className="text-xs text-muted-foreground">具备全链路证据</p><p className="mt-1 text-2xl font-semibold">{data.completeEvidenceUsers}<span className="ml-1 text-sm font-normal text-muted-foreground">人</span></p></div>
        <div className="rounded-xl bg-muted/55 p-4"><p className="text-xs text-muted-foreground">当前最大断点</p><p className="mt-1 text-sm font-semibold">{largestGap && (largestGap.gapFromPrevious ?? 0) > 0 ? `${largestGap.label}前流失 ${largestGap.gapFromPrevious} 人` : '尚无明确断点'}</p></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">这是已有数据的累计证据覆盖率，不等同于严格转化率或掌握度。完成课程 / 练习只统计已完成会话；知识关联只统计用户明确确认的关联。</p>
    </section>

    <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <p className="text-sm font-semibold">证据覆盖</p>
      {data.stages.map((stage) => {
        const percent = Math.round(stage.rate * 100)
        return <div key={stage.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs"><span className="font-medium">{stage.label}<span className="ml-2 font-normal text-muted-foreground">{stage.description}</span></span><span className="whitespace-nowrap text-muted-foreground">{stage.reached}/{stage.total} · <b className="text-foreground">{percent}%</b></span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand/55" style={{ width: `${percent}%` }} /></div>
          {stage.gapFromPrevious !== null && stage.gapFromPrevious > 0 && <p className="mt-1 text-[11px] text-orange-600 dark:text-orange-300">上一环已达成、但尚未到此环：{stage.gapFromPrevious} 人</p>}
        </div>
      })}
    </section>
  </div>
}
