'use client'

import { useState } from 'react'
import { toast } from '@/stores/toast-store'

export interface DisputeItem {
  id: string
  reason: string | null
  createdAt: string
  userEmail: string
  admission: {
    id: string
    university: string
    major: string
    year: number
    category: string
    data: Record<string, unknown>
    source: string
    verifyStatus: string
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  score_line: '📈 分数线',
  enrollment: '👥 招生人数',
  subjects: '📚 考试科目',
  tuition: '💰 学费',
  notes: '📝 其他',
}

export default function AdmissionDisputes({ initial }: { initial: DisputeItem[] }) {
  const [disputes, setDisputes] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  const resolve = async (item: DisputeItem, action: 'accept' | 'reject') => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/admin/admission-disputes/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '操作失败')
      setDisputes((prev) => prev.filter((d) => d.id !== item.id))
      toast.success(action === 'accept' ? '已确认错误，数据标记为存疑' : '已驳回质疑')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  if (disputes.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">✅ 没有待审核的院校数据质疑</div>
  }

  return (
    <div className="space-y-3">
      {disputes.map((d) => {
        const data = d.admission.data || {}
        return (
          <div key={d.id} className="rounded-2xl bg-card border border-border/50 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  🏫 {d.admission.university} {d.admission.major}
                  <span className="text-muted-foreground font-normal"> · {d.admission.year}年 {CATEGORY_LABEL[d.admission.category] || ''}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ 质疑：{d.reason || '（无原因）'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  来源：{d.admission.source?.slice(0, 80) || '未知'} · 质疑人：{d.userEmail} · {new Date(d.createdAt).toLocaleString('zh-CN')}
                </p>
                <p className="text-xs mt-2 bg-muted/40 rounded-lg px-2 py-1.5 line-clamp-3 text-muted-foreground">
                  {JSON.stringify(data).slice(0, 200)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => resolve(d, 'accept')}
                  disabled={busyId === d.id}
                  className="text-xs rounded-full bg-destructive/10 text-destructive border border-destructive/30 px-3 py-1.5 font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  确认错误
                </button>
                <button
                  onClick={() => resolve(d, 'reject')}
                  disabled={busyId === d.id}
                  className="text-xs rounded-full bg-muted text-muted-foreground border border-border px-3 py-1.5 font-medium hover:bg-muted/70 transition-colors disabled:opacity-50"
                >
                  驳回
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
