'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) throw error
      // 成功/失败统一显示（防枚举邮箱是否存在）
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">重置密码</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            输入注册邮箱，我们将发送重置链接
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
            <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4 text-sm text-green-700 dark:text-green-300">
              📬 若该邮箱已注册，重置链接已发送。<b>请检查收件箱和垃圾箱</b>。
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              没收到？联系作者在管理后台为你生成重置链接。
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">返回登录</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">邮箱</label>
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
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '发送中...' : '发送重置链接'}
            </Button>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              想起密码了？
              <Link href="/login" className="ml-1 text-blue-600 hover:underline">返回登录</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
