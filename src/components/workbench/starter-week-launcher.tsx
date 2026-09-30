'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/stores/toast-store'

interface StarterWeekLauncherProps {
  className?: string
  label?: string
}

/** 新用户的低承诺入口：一周探索，不把三项输入伪装成一份长期学习判断。 */
export function StarterWeekLauncher({ className, label = '开始首周探索' }: StarterWeekLauncherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [subject, setSubject] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = target.trim().length > 0 && subject.trim().length > 0 && Number(weeklyHours) >= 1

  const start = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/starter-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, subject, weeklyHours: Number(weeklyHours) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '创建首周探索失败')
      toast.success('首周探索已开始。先完成第一项，结束后留下一句自己的理解。')
      setOpen(false)
      router.push(`/tasks?week=${encodeURIComponent(data.starterWeek.weekStart)}&task=${encodeURIComponent(data.starterWeek.firstTaskId)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建首周探索失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" data-testid="starter-week-launcher" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => !submitting && setOpen(false)}
        title="开始我的首周探索"
        description="先不生成长期计划。用三个信息安排本周少量学习样本，完成后我们再依据真实记录设计路线。"
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>稍后再说</Button>
            <Button type="button" onClick={start} disabled={!canSubmit || submitting}>{submitting ? '正在开始…' : '确认并开始探索'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5" htmlFor="starter-target">
            <span className="text-sm font-medium">你要准备什么？</span>
            <input id="starter-target" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="例如：2027 考研 / 计算机类考研" maxLength={100} className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/20" />
          </label>
          <label className="block space-y-1.5" htmlFor="starter-subject">
            <span className="text-sm font-medium">当前最想补哪一科？</span>
            <input id="starter-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="例如：数学一、408 计算机网络、英语" maxLength={40} className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/20" />
          </label>
          <label className="block space-y-1.5" htmlFor="starter-hours">
            <span className="text-sm font-medium">每周大约能稳定投入几小时？</span>
            <input id="starter-hours" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} type="number" min="1" max="84" inputMode="numeric" placeholder="例如：12" className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/20" />
          </label>
          <div className="rounded-xl border border-brand/15 bg-brand-muted/35 p-3 text-sm leading-6 text-muted-foreground">
            你将看到 1–3 项真实任务：开始学习、回顾练习、整理发现。完成任务不会被系统自动判定为“掌握”。
          </div>
        </div>
      </Modal>
    </>
  )
}
