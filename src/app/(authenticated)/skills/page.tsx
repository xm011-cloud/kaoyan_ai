'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'

type SkillRow = {
  id: string
  name: string
  description: string | null
  icon: string
  triggerKeywords: string[]
  usageCount: number
  source: string
  lastRunAt: string | null
  noteCount: number
  noteLastLabel: string | null
}

const timeAgo = (iso: string | null) => {
  if (!iso) return '还没运行过'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SkillRow | null>(null)
  const [deleting, setDeleting] = useState<SkillRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/skills')
      const data = await res.json()
      setSkills(data.skills ?? [])
    } catch {
      setSkills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/skills/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          icon: editing.icon,
          triggerKeywords: editing.triggerKeywords,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '保存失败')
        return
      }
      setEditing(null)
      await load()
    } catch {
      setError('保存失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      await fetch(`/api/skills/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      await load()
    } catch {
      setError('删除失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="⚡ 我的技能"
        action={
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 rounded-xl bg-brand text-brand-foreground px-3 py-2 text-sm font-medium shadow-sm active:scale-[0.98] transition-all"
          >
            💬 去对话创建
          </Link>
        }
      />

      {/* 引导条 */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-900/20 dark:to-sky-900/20 border border-indigo-200/50 dark:border-indigo-500/20 p-4">
        <p className="text-sm">
          <span className="font-semibold">页面满足不了你？技能就是你的自定义层。</span>
          <br className="hidden sm:block" />
          <span className="text-muted-foreground">
            在对话里跑一遍你想要的流程，点「💾 存为技能」，它就会出现在这里，以后随时一键运行、跨会话累积你的档案。
          </span>
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-10">加载中...</p>
      ) : skills.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/50 p-10 text-center text-sm text-muted-foreground">
          🍃 还没有技能。去对话里跑一遍你想要的流程，然后点「存为技能」。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {skills.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-muted text-2xl shrink-0">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {s.description || '暂无描述'}
                  </div>
                </div>
              </div>

              {s.triggerKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.triggerKeywords.slice(0, 4).map((k) => (
                    <span
                      key={k}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {k}
                    </span>
                  ))}
                  {s.triggerKeywords.length > 4 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      +{s.triggerKeywords.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                <span>运行 {s.usageCount} 次</span>
                <span>档案 {s.noteCount} 条</span>
                <span>{timeAgo(s.lastRunAt)}</span>
                {s.source === 'template' && <span className="text-brand">模板</span>}
              </div>

              <div className="flex gap-2 mt-auto">
                <Link
                  href={`/chat?skill=${s.id}`}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-brand text-brand-foreground px-3 py-2 text-sm font-medium shadow-sm active:scale-[0.98] transition-all"
                >
                  ▶ 运行
                </Link>
                <button
                  onClick={() => setEditing(s)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all"
                >
                  编辑
                </button>
                <button
                  onClick={() => setDeleting(s)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        每个技能由你组装：数据快照 + 中途提问 + AI 指令 + 档案追加。步骤编辑（可视化）后续开放。
      </p>

      {/* 编辑弹窗 */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="编辑技能"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">编辑技能</h3>
            <label className="block">
              <span className="text-xs text-muted-foreground">名称</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">描述</span>
              <textarea
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">触发关键词（逗号分隔，用于 AI 主动提议）</span>
              <input
                value={editing.triggerKeywords.join('，')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    triggerKeywords: e.target.value.split(/[，,]/).map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex-1 rounded-xl bg-brand text-brand-foreground px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {busy ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setEditing(null)}
                disabled={busy}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="删除技能确认"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setDeleting(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">删除「{deleting.name}」？</h3>
            <p className="text-sm text-muted-foreground">
              它的技能档案也会一并清除，此操作不可撤销。运行过的对话记录不受影响。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-xl bg-destructive text-destructive-foreground px-3 py-2 text-sm font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {busy ? '删除中...' : '删除'}
              </button>
              <button
                onClick={() => setDeleting(null)}
                disabled={busy}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
