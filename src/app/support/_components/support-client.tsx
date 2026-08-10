'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Supporter = {
  id: string
  name: string
  message: string | null
  amount: number
  createdAt: string
}

// 收款码图片：加载失败时优雅降级为占位提示（作者上传前页面也正常）
function QrImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="aspect-square w-40 sm:w-44 rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground">
        <span className="text-2xl">🖼️</span>
        <span className="text-xs">收款码待上传</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="aspect-square w-40 sm:w-44 rounded-2xl border border-border/60 bg-white object-contain"
    />
  )
}

export default function SupportClient() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [wallLoading, setWallLoading] = useState(true)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/support')
      .then((r) => r.json())
      .then((d) => setSupporters(d.supporters ?? []))
      .catch(() => {})
      .finally(() => setWallLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message, honeypot }),
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
    <div className="flex flex-col items-center px-6 py-12 lg:py-16 bg-gradient-to-b from-orange-50/60 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-3xl w-full space-y-10">
        {/* Hero */}
        <section className="text-center">
          <div className="inline-flex items-center gap-1 px-3 py-1 mb-6 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full">
            ☕ 支持独立开发者
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight">
            请作者喝一杯咖啡
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">¥9.9 · 一杯咖啡，让 AI 考研助手走得更远</p>
          <p className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto">
            这个网站是我一个人业余时间开发的，全部功能免费。如果你觉得它有用，可以请我喝杯咖啡支持一下 ——
            你的支持是我持续迭代的最大动力 🙏
          </p>
        </section>

        {/* 收款码 */}
        <section className="rounded-3xl bg-card border border-border/50 shadow-sm p-8 text-center">
          <h2 className="text-lg font-bold mb-1">扫码转账 ¥9.9</h2>
          <p className="text-sm text-muted-foreground mb-6">转账时备注你的昵称，我就能在感谢墙认出你 👀</p>
          <div className="flex items-start justify-center gap-8 flex-wrap">
            <div className="flex flex-col items-center gap-2">
              <QrImage src="/payment/wechat.png" alt="微信收款码" />
              <span className="text-xs font-medium text-muted-foreground">微信</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <QrImage src="/payment/alipay.jpg" alt="支付宝收款码" />
              <span className="text-xs font-medium text-muted-foreground">支付宝</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6">金额随心，9.9 只是建议价 · 谢谢你的善意 ✨</p>
        </section>

        {/* 留言表单 */}
        <section className="rounded-3xl bg-card border border-border/50 shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-1">在感谢墙留个名</h2>
          <p className="text-sm text-muted-foreground mb-5">写下你的昵称和想说的话，作者审核后会展示在感谢墙</p>

          {submitted ? (
            <div className="rounded-2xl bg-success/10 text-success p-4 text-center text-sm">
              ✅ 留言已收到！审核通过后会展示在感谢墙，谢谢你的支持 🙏
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 蜜罐字段：真人看不见，机器人填了就静默拒绝 */}
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
                <label htmlFor="s-name" className="block text-sm font-medium mb-1.5">昵称</label>
                <input
                  id="s-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的昵称"
                  required
                  maxLength={30}
                  className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label htmlFor="s-message" className="block text-sm font-medium mb-1.5">留言（选填）</label>
                <textarea
                  id="s-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="想对作者说点什么…"
                  rows={3}
                  maxLength={200}
                  className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all">
                {submitting ? '提交中...' : '提交留言'}
              </Button>
            </form>
          )}
        </section>

        {/* 感谢墙 */}
        <section className="rounded-3xl bg-card border border-border/50 shadow-sm p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-4">感谢墙 🙏</h2>
          {wallLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : supporters.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="text-3xl mb-2">🫖</div>
              <p className="text-sm">还没有人上墙，来做第一个请作者喝咖啡的人吧</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {supporters.map((s) => (
                <li key={s.id} className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">✨ {s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ¥{s.amount} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  {s.message && <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap break-words">{s.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pb-4 text-center text-xs text-muted-foreground">
          © 2026 AI 考研助手 · 支持作者 / 感谢每一位认真生活的人
        </footer>
      </div>
    </div>
  )
}
