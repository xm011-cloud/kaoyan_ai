'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

const TYPES = [
  { id: 'problem', label: '页面有问题', hint: '点不动、报错或结果不对' },
  { id: 'confusing', label: '这里看不懂', hint: '不知道该做什么或为什么这样做' },
  { id: 'idea', label: '我有建议', hint: '希望它变得更顺手' },
  { id: 'praise', label: '想表扬一下', hint: '告诉我们什么值得保留' },
  { id: 'other', label: '其他', hint: '任何想说的话' },
] as const

type FeedbackType = (typeof TYPES)[number]['id'] | 'general'
type Feedback = {
  id: string
  content: string
  type: FeedbackType
  sourcePath: string | null
  status: string
  authorNote: string | null
  releaseVersion: string | null
  createdAt: string
}

const STATUS_COPY: Record<string, { label: string; detail: string; className: string }> = {
  new: { label: '已收到', detail: '等待作者分诊', className: 'bg-brand/10 text-brand' },
  triaged: { label: '正在复现', detail: '我们正在确认问题和影响范围', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  planned: { label: '已排期', detail: '已进入后续改动计划', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200' },
  released: { label: '已发布', detail: '修复或改动已经上线', className: 'bg-success/10 text-success' },
  closed: { label: '暂不处理', detail: '当前版本暂不推进，作者会说明原因', className: 'bg-muted text-muted-foreground' },
  read: { label: '已查看', detail: '这是旧反馈状态，正在迁移到新的处理流程', className: 'bg-muted text-muted-foreground' },
  resolved: { label: '已解决', detail: '这是旧反馈状态', className: 'bg-success/10 text-success' },
}

function getClientContext() {
  if (typeof window === 'undefined') return null
  return {
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    device: window.matchMedia('(max-width: 767px)').matches ? '手机' : window.matchMedia('(max-width: 1023px)').matches ? '平板' : '桌面',
    locale: navigator.language,
  }
}

export default function SuggestionsClient() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [type, setType] = useState<FeedbackType>('problem')
  const [content, setContent] = useState(() => searchParams.get('content') || '')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<Feedback | null>(null)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')

  const activeType = useMemo(() => TYPES.find((item) => item.id === type) || TYPES[0], [type])

  useEffect(() => {
    let cancelled = false
    fetch('/api/suggestions', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '读取反馈状态失败')
        if (!cancelled) setFeedbacks(data.feedbacks || [])
      })
      .catch(() => { if (!cancelled) setFeedbacks([]) })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, sourcePath: pathname, clientContext: getClientContext(), honeypot }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || '提交失败')
      setSubmitted(data.feedback)
      setFeedbacks((previous) => [data.feedback, ...previous])
      setContent('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <header>
        <p className="workspace-kicker text-brand">产品反馈</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">问题与建议</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">哪里不对、哪里看不懂、希望怎样变好，都可以直接告诉我们。无需打分；反馈只对作者可见，并会带上当前页面和设备摘要，方便复现。</p>
      </header>

      <form onSubmit={handleSubmit} className="workspace-surface space-y-5 p-5 sm:p-6">
        <input type="text" name="company" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <fieldset>
          <legend className="text-sm font-medium">这次想告诉我们什么？</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id)}
                aria-pressed={type === item.id}
                className={`min-h-12 rounded-xl border px-3 py-2.5 text-left transition-colors ${type === item.id ? 'border-brand bg-brand/5 text-foreground ring-1 ring-brand/20' : 'border-border/60 bg-background text-muted-foreground hover:border-brand/30 hover:text-foreground'}`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-5">{item.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="fb-content" className="block text-sm font-medium">发生了什么？</label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">可按“我想做什么 → 做到哪一步 → 实际发生什么 → 原本期待什么”描述。</p>
          <textarea
            id="fb-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={type === 'praise' ? '例如：我特别喜欢……，因为……' : `例如：我在「${activeType.label}」时，做到……，实际出现……，我原本以为会……`}
            rows={5}
            required
            maxLength={2000}
            className="mt-3 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand/20"
          />
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>将附带：{pathname} · 当前设备摘要</span><span>{content.length}/2000</span></div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting || !content.trim()} className="min-h-11 w-full rounded-xl bg-brand font-semibold text-brand-foreground hover:bg-brand/90">
          {submitting ? '正在提交…' : '提交给作者'}
        </Button>
      </form>

      {submitted && (
        <section role="status" className="workspace-surface border-success/25 bg-success/5 p-5">
          <p className="font-medium text-success">反馈已收到</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">它现在是“已收到”，作者分诊后你会在下方看到新的处理状态。</p>
          <button type="button" onClick={() => setSubmitted(null)} className="mt-3 text-sm font-medium text-brand hover:underline">继续提交另一条</button>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">我的反馈进度</h2><p className="mt-1 text-xs text-muted-foreground">仅你和作者可见。</p></div><span className="text-xs text-muted-foreground">最近 20 条</span></div>
        {loadingHistory ? <div className="workspace-surface p-5 text-sm text-muted-foreground">正在读取反馈状态…</div> : feedbacks.length === 0 ? (
          <div className="workspace-surface p-5 text-sm leading-6 text-muted-foreground">还没有提交过反馈。遇到不对劲的地方，直接写下来就好。</div>
        ) : feedbacks.map((feedback) => {
          const status = STATUS_COPY[feedback.status] || STATUS_COPY.new
          const typeLabel = TYPES.find((item) => item.id === feedback.type)?.label || '历史反馈'
          return (
            <article key={feedback.id} className="workspace-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted-foreground">{typeLabel}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></div><time className="text-xs text-muted-foreground">{new Date(feedback.createdAt).toLocaleDateString('zh-CN')}</time></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{feedback.content}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{status.detail}{feedback.sourcePath ? ` · 来自 ${feedback.sourcePath}` : ''}{feedback.releaseVersion ? ` · 发布版本 ${feedback.releaseVersion}` : ''}</p>
              {feedback.authorNote && <div className="mt-3 rounded-xl bg-muted/45 px-3 py-2.5 text-sm leading-6"><span className="text-xs font-medium text-brand">作者说明</span><p className="mt-1 whitespace-pre-wrap">{feedback.authorNote}</p></div>}
            </article>
          )
        })}
      </section>
    </div>
  )
}
