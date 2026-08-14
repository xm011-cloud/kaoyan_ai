'use client'

import { useState } from 'react'
import { toast } from '@/stores/toast-store'

export interface DeletionRequestItem {
  id: string
  userId: string
  email: string
  status: string
  createdAt: string
  handledAt: string | null
}

export default function DeletionRequests({ initial }: { initial: DeletionRequestItem[] }) {
  const [items, setItems] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  const markDone = async (item: DeletionRequestItem) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/admin/deletion-requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '操作失败')
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'done', handledAt: new Date().toISOString() } : i)))
      toast.success('已标记处理完成')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">✅ 暂无账号注销请求</div>
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card border border-border/50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold">🗑️ {r.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                申请时间：{new Date(r.createdAt).toLocaleString('zh-CN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">用户 ID：{r.userId}</p>
              <p className="text-[11px] mt-2 bg-muted/40 rounded-lg px-2 py-1.5 text-muted-foreground">
                处理步骤：① Supabase 控制台 → Authentication → Users → 删除该邮箱用户（级联清理 Auth）；② 确认本地数据随 userId 关联删除（本地 User 行及其学习数据按关联 Cascade 清理）；③ 点击右侧「标记完成」。
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'done' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {r.status === 'done' ? '✅ 已处理' : '⏳ 待处理'}
              </span>
              {r.status === 'pending' && (
                <button
                  onClick={() => markDone(r)}
                  disabled={busyId === r.id}
                  className="text-xs rounded-full bg-brand px-3 py-1.5 font-medium text-brand-foreground hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  标记完成
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
