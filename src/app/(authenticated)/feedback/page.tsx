'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleLinks } from '@/components/ui/module-links'

interface Feedback {
  id: string
  weekStart: string
  weekEnd: string
  content: string
  suggestions: string[]
  createdAt: string
  stats?: {
    prevWeek: { checkInDays: number; totalMinutes: number; taskCompleted: number; taskTotal: number }
    thisWeek: { checkInDays: number; totalMinutes: number; taskCompleted: number; taskTotal: number }
  } | null
}

// 上周 vs 本周对比进度条（软化非零和：和自己的上周比）
function CompareBars({ stats }: { stats: NonNullable<Feedback['stats']> }) {
  const { prevWeek: p, thisWeek: t } = stats
  const weekMax = 7
  const hour = (min: number) => (min / 60).toFixed(1)

  const rows = [
    {
      label: '打卡天数',
      prev: { value: p.checkInDays, max: weekMax, text: `${p.checkInDays}/7 天` },
      curr: { value: t.checkInDays, max: weekMax, text: `${t.checkInDays}/7 天` },
    },
    {
      label: '学习时长',
      prev: { value: p.totalMinutes, max: Math.max(p.totalMinutes, t.totalMinutes, 1), text: `${hour(p.totalMinutes)}h` },
      curr: { value: t.totalMinutes, max: Math.max(p.totalMinutes, t.totalMinutes, 1), text: `${hour(t.totalMinutes)}h` },
    },
    {
      label: '任务完成',
      prev: { value: p.taskCompleted, max: Math.max(p.taskTotal, t.taskTotal, 1), text: `${p.taskCompleted}/${p.taskTotal}` },
      curr: { value: t.taskCompleted, max: Math.max(p.taskTotal, t.taskTotal, 1), text: `${t.taskCompleted}/${t.taskTotal}` },
    },
  ]

  return (
    <div className="rounded-xl border border-border/50 p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">和上周的自己比</p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[72px_1fr_28px] items-center gap-3">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-6 shrink-0 text-right">上周</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: `${(r.prev.value / r.prev.max) * 100}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-6 shrink-0 text-right">本周</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(r.curr.value / r.curr.max) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-1">
              <div className="text-right">{r.prev.text}</div>
              <div className="text-right text-foreground/80">{r.curr.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Milestone {
  totalCheckIns: number
  currentStreak: number
  weekCheckIns: number
  unreviewedWrongCount: number
  completedMilestones: number
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const loadFeedbacks = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      setFeedbacks(data.feedbacks || [])
      setMilestone(data.milestone ?? null)
    } catch {
      // 加载失败
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeedbacks()
  }, [loadFeedbacks])

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/ai/generate-feedback', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')

      if (data.regenerated === false) {
        setGenError('本周反馈已存在，无需重复生成')
      } else {
        setFeedbacks(prev => [data.feedback, ...prev])
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('zh-CN')
    const e = new Date(end).toLocaleDateString('zh-CN')
    return `${s} - ${e}`
  }

  // 本周范围
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="学习周报"
          subtitle="AI 基于你的学习数据生成周报和建议"
          action={
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'AI 分析中...' : '生成本周反馈'}
            </Button>
          }
        />

        {genError && (
          <p className={`text-sm px-4 py-2 rounded ${genError.includes('已存在') ? 'bg-brand/10 text-brand' : 'bg-red-50 text-destructive dark:bg-red-900/30'}`}>
            {genError}
          </p>
        )}

        {/* 具体数字里程碑肯定 */}
        {milestone && (milestone.currentStreak > 1 || milestone.completedMilestones > 0) && (
          <div className="rounded-2xl bg-muted/40 border border-border/50 px-5 py-4 text-sm">
            <p className="text-muted-foreground">
              {milestone.currentStreak > 1 && (
                <>你已经连续打卡 <span className="font-semibold text-foreground">{milestone.currentStreak} 天</span>，累计 <span className="font-semibold text-foreground">{milestone.totalCheckIns} 天</span></>
              )}
              {milestone.currentStreak > 1 && milestone.completedMilestones > 0 && ' · '}
              {milestone.completedMilestones > 0 && (
                <>学习路径上已经完成 <span className="font-semibold text-foreground">{milestone.completedMilestones} 个里程碑</span></>
              )}
              ，每一步都算数 💪
            </p>
          </div>
        )}

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border/50">
              <div className="text-4xl mb-3">📊</div>
              <p className="font-medium">暂无学习反馈</p>
              <p className="text-sm mt-1">
                完成一周的学习后，点击上方按钮让 AI 为你生成专属反馈
              </p>
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div key={feedback.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                {/* 头部 */}
                <div className="px-6 py-4 bg-gradient-to-r from-brand/8 to-brand/3 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">
                      📅 {formatWeek(feedback.weekStart, feedback.weekEnd)}
                    </h2>
                    <span className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full">
                      生成于 {new Date(feedback.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>

                {/* 内容 */}
                <div className="px-6 py-4 space-y-4">
                  {feedback.stats && <CompareBars stats={feedback.stats} />}

                  <div className="bg-muted/50 p-4 rounded-xl">
                    <p className="text-foreground/80 leading-relaxed">{feedback.content}</p>
                  </div>

                  {feedback.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm flex items-center gap-1">
                        <span>🤖</span> AI 建议
                      </h3>
                      <ul className="space-y-2">
                        {feedback.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-brand mt-0.5 shrink-0">▸</span>
                            <span className="text-muted-foreground">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 模块联动 */}
        <ModuleLinks
          links={[
            { href: "/tasks", icon: "📋", label: "任务计划" },
            { href: "/study-path", icon: "🗺️", label: "学习路径" },
            { href: "/practice", icon: "✏️", label: "去练习" },
            { href: "/wrong-questions", icon: "📕", label: "刷错题" },
          ]}
        />
      </div>
    </div>
  )
}
