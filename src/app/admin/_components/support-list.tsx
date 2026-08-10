'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type SupporterItem = {
  id: string
  name: string
  amount: number
  message: string | null
  approved: boolean
  createdAt: string
  user: { email: string | null } | null
}

export default function SupportList({ initial }: { initial: SupporterItem[] }) {
  const [items, setItems] = useState(initial)

  const setApproved = async (id: string, approved: boolean) => {
    const res = await fetch(`/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    })
    if (!res.ok) return
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, approved } : s)))
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/support/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setItems((prev) => prev.filter((s) => s.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-10 text-center text-sm text-muted-foreground">
        ☕ 还没有支持留言
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <div key={s.id} className={`rounded-2xl bg-card border shadow-sm p-5 ${s.approved ? 'border-border/50' : 'border-orange-300/60 dark:border-orange-500/40'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">✨ {s.name}</span>
            <span className="text-xs text-muted-foreground">¥{s.amount}</span>
            {s.approved ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">已上墙</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium">待审核</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{new Date(s.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          {s.message && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">{s.message}</p>}
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              {s.user?.email ? `登录用户 ${s.user.email}` : '游客'}
            </span>
            <div className="flex gap-1.5">
              {!s.approved && (
                <Button size="sm" onClick={() => setApproved(s.id, true)} className="rounded-full h-8 text-xs bg-brand hover:bg-brand/90 text-brand-foreground">通过上墙</Button>
              )}
              {s.approved && (
                <Button variant="outline" size="sm" onClick={() => setApproved(s.id, false)} className="rounded-full h-8 text-xs">撤回</Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => remove(s.id)} className="rounded-full h-8 text-xs">删除</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
