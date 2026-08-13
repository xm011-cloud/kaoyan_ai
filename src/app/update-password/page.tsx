'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // 双保险：无会话则回登录页（中间件已拦截未登录，这里兜底过期场景）
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) router.replace('/login?error=recovery')
      })
      .catch(() => router.replace('/login?error=recovery'))
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '设置失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">设置新密码</h1>
          <p className="mt-2 text-muted-foreground">
            验证通过，请输入新密码
          </p>
        </div>

        {done ? (
          <div className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
            <div className="rounded-xl bg-success/10 p-4 text-sm text-success">
              ✅ 密码已更新，请使用新密码登录。
            </div>
            <Link href="/dashboard">
              <Button className="w-full">前往概览</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">新密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1">确认新密码</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次输入新密码"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '提交中...' : '更新密码'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
