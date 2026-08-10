'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 手写星级：5 个按钮，渲染确定性（初始 value=0），无 hydration 错配
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="给作者评分" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} 星`}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none transition-transform active:scale-90 ${
            n <= value ? 'text-amber-400' : 'text-muted-foreground/25 hover:text-muted-foreground/50'
          }`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{value ? `${value} 星` : '点击评分'}</span>
    </div>
  )
}

export default function SuggestionsClient() {
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, content, anonymous, honeypot }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '提交失败')
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">意见反馈</h1>
        <p className="text-sm text-muted-foreground mt-1">给作者打个分、提个建议，我会认真看每一条 🙏</p>
      </div>

      {submitted ? (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-bold">已收到你的反馈！</h2>
          <p className="text-sm text-muted-foreground mt-2">感谢你的时间和用心，作者会尽快查看</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-5">
          {/* 蜜罐字段 */}
          <input
            type="text"
            name="company"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div>
            <label className="block text-sm font-medium mb-2">整体评分</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <label htmlFor="fb-content" className="block text-sm font-medium mb-1.5">
              你的建议 / 想法
            </label>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="哪里好用？哪里难用？想要什么新功能？"
              rows={5}
              required
              maxLength={2000}
              className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
            />
            <p className="text-right text-xs text-muted-foreground mt-1">{content.length}/2000</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-brand"
            />
            匿名提交（不展示我的邮箱）
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting || !rating} className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all">
            {submitting ? '提交中...' : '提交反馈'}
          </Button>
        </form>
      )}
    </div>
  )
}
