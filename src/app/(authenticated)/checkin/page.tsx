'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleLinks } from '@/components/ui/module-links'

// 打卡状态元数据：三态表情/文案 + 成功态的安抚/肯定句（心路成长表达规范）
const STATUS_META = {
  good: {
    label: '状态很好',
    emoji: '😊',
    affirm: '状态满分的一天，趁热打铁，保持这个节奏。',
  },
  normal: {
    label: '状态一般',
    emoji: '😐',
    affirm: '状态一般也能坚持完成打卡，这就是稳定推进。明天从一件小事开始。',
  },
  tired: {
    label: '有点疲惫',
    emoji: '😫',
    affirm: '累了还愿意记录这一刻，这本身就是韧性。今天剩下的时间，先照顾好自己。',
  },
} as const

type CheckinStatus = keyof typeof STATUS_META

interface Milestone {
  totalCheckIns: number
  currentStreak: number
  weekCheckIns: number
  unreviewedWrongCount: number
  completedMilestones: number
}

export default function CheckInPage() {
  const [duration, setDuration] = useState('')
  const [status, setStatus] = useState<CheckinStatus>('good')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [todayCheckIn, setTodayCheckIn] = useState<{
    duration: number
    status: string
    note?: string | null
  } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // 加载今日打卡记录
  useEffect(() => {
    const loadToday = async () => {
      try {
        const res = await fetch(`/api/checkin?date=${today}`)
        const data = await res.json()
        if (data.checkIn) {
          setTodayCheckIn(data.checkIn)
          setSubmitted(true)
        }
      } catch {
        // 忽略
      }
    }
    loadToday()
  }, [today])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          duration,
          status,
          note: note || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '打卡失败')

      setSubmitted(true)
      setTodayCheckIn(data.checkIn)
      setMilestone(data.milestone ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  if (submitted && todayCheckIn) {
    return (
      <div className="flex flex-1 flex-col p-4 lg:p-6">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <PageHeader title="打卡" subtitle="记录今天的学习情况" />
          <div className="bg-card p-6 rounded-2xl border border-border/50 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold">今日已打卡！</h2>
            <div className="text-muted-foreground space-y-1">
              <p>学习时长：{todayCheckIn.duration} 分钟</p>
              <p>
                状态：{STATUS_META[todayCheckIn.status as CheckinStatus]?.emoji}{' '}
                {STATUS_META[todayCheckIn.status as CheckinStatus]?.label}
              </p>
              {todayCheckIn.note && <p>备注：{todayCheckIn.note}</p>}
            </div>

            {/* 安抚/肯定句 + 具体数字里程碑 */}
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="text-foreground/90">
                {STATUS_META[todayCheckIn.status as CheckinStatus]?.affirm}
              </p>
              {milestone && (
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {milestone.currentStreak > 1 && (
                    <span>🔥 已连续打卡 {milestone.currentStreak} 天</span>
                  )}
                  <span>📅 累计打卡 {milestone.totalCheckIns} 天</span>
                  {milestone.completedMilestones > 0 && (
                    <span>🏁 已完成 {milestone.completedMilestones} 个里程碑</span>
                  )}
                  {milestone.unreviewedWrongCount > 0 && (
                    <span>📚 还有 {milestone.unreviewedWrongCount} 道错题待复习</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => {
                setSubmitted(false)
                setTodayCheckIn(null)
                setDuration('')
                setNote('')
              }}>
                {todayCheckIn ? '修改打卡' : '再次打卡'}
              </Button>
              <Link href="/leaderboard">
                <Button variant="outline" className="w-full">🏆 看看这周排名</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">打卡</h1>
          <p className="text-muted-foreground mt-1">记录今天的学习情况</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl border border-border/50">
          <div>
            <label htmlFor="checkin-duration" className="block text-sm font-medium mb-1">学习时长（分钟）</label>
            <input
              id="checkin-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="例如：120"
              required
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">今日状态</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(STATUS_META) as CheckinStatus[]).map((key) => {
                const item = STATUS_META[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`p-3 rounded-xl border border-border/50 text-center transition-colors ${
                      status === key
                        ? 'border-brand bg-brand-muted'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="text-2xl">{item.emoji}</div>
                    <div className="text-xs mt-1">{item.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="checkin-note" className="block text-sm font-medium mb-1">备注（可选）</label>
            <textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="今天学了什么？有什么收获？"
              rows={3}
              className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '打卡中...' : '完成打卡'}
          </Button>
        </form>

        {/* 模块联动 */}
        <ModuleLinks
          links={[
            { href: "/pomodoro", icon: "🍅", label: "番茄钟" },
            { href: "/tasks", icon: "📋", label: "任务计划" },
            { href: "/leaderboard", icon: "🏆", label: "学习排行榜" },
          ]}
        />
      </div>
    </div>
  )
}
