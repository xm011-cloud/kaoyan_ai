'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type FeedbackItem = {
  id: string
  rating: number
  content: string
  anonymous: boolean
  status: string // "new" | "read" | "resolved"
  createdAt: string
  user: { email: string | null; name: string | null }
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  new: { text: '新', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  read: { text: '已读', cls: 'bg-muted text-muted-foreground' },
  resolved: { text: '已解决', cls: 'bg-success/10 text-success' },
}

export default function FeedbackList({ initial }: { initial: FeedbackItem[] }) {
  const [items, setItems] = useState(initial)

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
  }

  if (items.length === 0) {
    return <EmptyCard text="还没有收到反馈，快去听听用户的声音吧" />
  }

  return (
    <div className="space-y-3">
      {items.map((f) => {
        const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.new
        return (
          <div key={f.id} className="rounded-2xl bg-card border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-400 tracking-tight">{'★'.repeat(f.rating)}<span className="text-muted-foreground/30">{'★'.repeat(5 - f.rating)}</span></span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>
              <span className="text-xs text-muted-foreground ml-auto">{new Date(f.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap break-words">{f.content}</p>
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                {f.anonymous ? '匿名用户' : `来自 ${f.user.name || f.user.email || '用户'}`}
              </span>
              <div className="flex gap-1.5">
                {f.status !== 'read' && (
                  <Button variant="outline" size="sm" onClick={() => setStatus(f.id, 'read')} className="rounded-full h-8 text-xs">标记已读</Button>
                )}
                {f.status !== 'resolved' && (
                  <Button variant="outline" size="sm" onClick={() => setStatus(f.id, 'resolved')} className="rounded-full h-8 text-xs">标记已解决</Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-10 text-center text-sm text-muted-foreground">
      🎈 {text}
    </div>
  )
}
