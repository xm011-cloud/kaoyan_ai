'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

export type FeedbackItem = {
  id: string
  rating: number
  content: string
  anonymous: boolean
  type: string
  sourcePath: string | null
  clientContext: unknown
  status: string
  authorNote: string | null
  releaseVersion: string | null
  createdAt: string
  updatedAt: string
  user: { email: string | null; name: string | null }
}

const STATUS = [
  { id: 'new', label: '待分诊' },
  { id: 'triaged', label: '待复现' },
  { id: 'planned', label: '已计划' },
  { id: 'released', label: '已发布' },
  { id: 'closed', label: '暂不处理' },
  { id: 'read', label: '已读（旧）' },
  { id: 'resolved', label: '已解决（旧）' },
] as const

const TYPE_LABEL: Record<string, string> = {
  problem: '页面有问题',
  confusing: '这里看不懂',
  idea: '我有建议',
  praise: '表扬',
  other: '其他',
  general: '历史反馈',
}

const STATUS_CLASS: Record<string, string> = {
  new: 'bg-brand/10 text-brand',
  triaged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  planned: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  released: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
  read: 'bg-muted text-muted-foreground',
  resolved: 'bg-success/10 text-success',
}

type Draft = { status: string; authorNote: string; releaseVersion: string }

function contextText(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const context = value as Record<string, unknown>
  return [context.device, context.viewport, context.locale].filter((item): item is string => typeof item === 'string' && Boolean(item)).join(' · ') || null
}

function FeedbackCard({ item, onSaved }: { item: FeedbackItem; onSaved: (next: FeedbackItem) => void }) {
  const [draft, setDraft] = useState<Draft>({ status: item.status, authorNote: item.authorNote || '', releaseVersion: item.releaseVersion || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const context = contextText(item.clientContext)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      onSaved({ ...item, ...data.feedback, createdAt: new Date(data.feedback.createdAt).toISOString(), updatedAt: new Date(data.feedback.updatedAt).toISOString() })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="workspace-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{TYPE_LABEL[item.type] || '历史反馈'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[item.status] || STATUS_CLASS.new}`}>{STATUS.find((status) => status.id === item.status)?.label || item.status}</span></div>
        <time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('zh-CN')}</time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{item.anonymous ? '匿名展示请求' : `来自 ${item.user.name || item.user.email || '用户'}`}</span>{item.sourcePath && <span>页面：{item.sourcePath}</span>}{context && <span>设备：{context}</span>}{item.rating !== 3 && <span>旧评分：{item.rating}/5</span>}</div>

      <div className="mt-4 grid gap-3 border-t border-border/55 pt-4 sm:grid-cols-[150px_1fr]">
        <label className="text-sm font-medium">处理状态<select aria-label="处理状态" value={draft.status} onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-sm font-normal"><option value="new">待分诊</option><option value="triaged">待复现</option><option value="planned">已计划</option><option value="released">已发布</option><option value="closed">暂不处理</option><option value="read">已读（旧）</option><option value="resolved">已解决（旧）</option></select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">发布版本<input value={draft.releaseVersion} onChange={(event) => setDraft((previous) => ({ ...previous, releaseVersion: event.target.value }))} maxLength={100} placeholder="例如 03f0f3f（可选）" className="mt-1.5 h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-sm font-normal" /></label><label className="text-sm font-medium">作者说明<textarea value={draft.authorNote} onChange={(event) => setDraft((previous) => ({ ...previous, authorNote: event.target.value }))} maxLength={2000} rows={2} placeholder="说明复现情况、取舍或修复内容；用户可见" className="mt-1.5 w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm font-normal" /></label></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span role="alert" className="text-xs text-destructive">{error}</span><Button size="sm" onClick={() => void save()} disabled={saving} className="min-h-10">{saving ? '保存中…' : '保存分诊结果'}</Button></div>
    </article>
  )
}

export default function FeedbackList({ initial }: { initial: FeedbackItem[] }) {
  const [items, setItems] = useState(initial)
  const [statusFilter, setStatusFilter] = useState('open')
  const [typeFilter, setTypeFilter] = useState('all')
  const filtered = useMemo(() => items.filter((item) => (statusFilter === 'all' || (statusFilter === 'open' ? !['released', 'closed', 'resolved'].includes(item.status) : item.status === statusFilter)) && (typeFilter === 'all' || item.type === typeFilter)), [items, statusFilter, typeFilter])
  const saveItem = (next: FeedbackItem) => setItems((previous) => previous.map((item) => item.id === next.id ? next : item))

  return (
    <section className="space-y-4">
      <div className="workspace-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">产品反馈收件箱</h2><p className="mt-1 text-sm text-muted-foreground">先分诊，再复现、排期或说明取舍。作者说明会回到提交用户的反馈进度中。</p></div><div className="flex flex-wrap gap-2"><label className="text-xs text-muted-foreground">状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-1 h-9 rounded-lg border border-border/60 bg-background px-2 text-sm text-foreground"><option value="open">未关闭</option><option value="all">全部</option>{STATUS.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><label className="text-xs text-muted-foreground">类型<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="ml-1 h-9 rounded-lg border border-border/60 bg-background px-2 text-sm text-foreground"><option value="all">全部</option>{Object.entries(TYPE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div></div>
      {filtered.length === 0 ? <div className="workspace-surface p-8 text-center text-sm text-muted-foreground">当前筛选下没有反馈。</div> : filtered.map((item) => <FeedbackCard key={item.id} item={item} onSaved={saveItem} />)}
    </section>
  )
}
