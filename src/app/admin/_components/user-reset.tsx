'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/stores/toast-store'

// 管理后台：为某邮箱生成密码重置链接（跨浏览器通道，token_hash 直链）
export default function UserReset() {
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setLink('')
    try {
      const res = await fetch('/api/admin/users/reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '生成失败')
      setLink(data.resetLink)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('链接已复制')
    } catch {
      // 手动复制兜底
      prompt('复制这个链接发给用户：', link)
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-4">
      <div>
        <h2 className="font-semibold">🔑 生成重置密码链接</h2>
        <p className="text-sm text-muted-foreground mt-1">
          把生成的链接发给用户，他在任意浏览器/无痕窗口打开即可设置新密码（无需邮件）。
        </p>
      </div>

      <form onSubmit={generate} className="space-y-3">
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="用户注册邮箱"
          required
          className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all">
          {loading ? '生成中...' : '生成重置链接'}
        </Button>
      </form>

      {link && (
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm break-all font-mono text-xs text-muted-foreground">{link}</p>
          <Button type="button" variant="outline" onClick={copy} className="rounded-full h-9 text-xs active:scale-[0.97]">📋 复制链接</Button>
        </div>
      )}
    </div>
  )
}
