'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recoveryError, setRecoveryError] = useState(false)
  const router = useRouter()

  // 重置链接无效/过期时（/auth/callback 兜底跳转）显示提示。
  // 不用 useSearchParams：静态 client 页需 Suspense 边界，这里直接读 location。
  useEffect(() => {
    setRecoveryError(new URLSearchParams(window.location.search).get('error') === 'recovery')
  }, [])

  const getSupabase = useCallback(() => createClient(), [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = getSupabase()
      if (isSignUp) {
        // 注册：服务端校验邀请码 + admin.createUser 建号（email_confirm=true）
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, inviteCode, honeypot }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error || '注册失败')
        // 账号已确认，直接登录进 dashboard
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI 考研助手</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isSignUp ? '创建新账户' : '登录你的账户'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
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
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {!isSignUp && (
            <p className="text-right -mt-2">
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                忘记密码?
              </Link>
            </p>
          )}

          {isSignUp && (
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium mb-1">
                邀请码
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="向管理员获取邀请码"
                required
                autoComplete="off"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}

          {recoveryError && (
            <p className="text-sm text-red-500">
              重置链接无效或已过期，请重新申请。
            </p>
          )}

          {error && (
            <p className={`text-sm ${error.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '处理中...' : isSignUp ? '注册' : '登录'}
          </Button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            {isSignUp ? '已有账户？' : '没有账户？'}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1 text-blue-600 hover:underline"
            >
              {isSignUp ? '登录' : '注册'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
