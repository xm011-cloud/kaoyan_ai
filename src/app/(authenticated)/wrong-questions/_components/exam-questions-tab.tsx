'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from '@/stores/toast-store'
import { confirmDialog } from '@/stores/confirm-store'

interface ExamItem {
  id: string
  subject: string
  year: number
  type: string
  question: string
  answer: string
  source: string
  sourceName: string | null
  tags: string[]
  createdAt: string
}

interface ExamListResponse {
  questions: ExamItem[]
  counts: Record<string, number>
  total: number
}

/** 错题本页「真题」Tab：管理已联网导入的真题 + 导入入口 */
export function ExamQuestionsTab({ subjects }: { subjects: string[] }) {
  const [items, setItems] = useState<ExamItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('')

  // 导入表单
  const [importSubject, setImportSubject] = useState(subjects[0] || '')
  const [importYear, setImportYear] = useState('')
  const [importKeywords, setImportKeywords] = useState('')
  const [importCount, setImportCount] = useState(5)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (subjectFilter) params.set('subject', subjectFilter)
      const res = await fetch(`/api/questions?${params.toString()}`)
      const data: ExamListResponse = await res.json()
      setItems(data.questions || [])
      setCounts(data.counts || {})
      setTotal(data.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [subjectFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleImport = async () => {
    if (!importSubject) return
    setImporting(true)
    try {
      const res = await fetch('/api/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: importSubject,
          year: importYear ? parseInt(importYear) : undefined,
          keywords: importKeywords.trim() || undefined,
          count: importCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '导入失败')
        return
      }
      toast.success(`✅ 导入 ${data.totalImported || 0} 道真题（来自 ${data.sources?.length || 0} 个来源）`)
      setImportKeywords('')
      load()
    } catch {
      toast.error('导入失败，请稍后再试')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (item: ExamItem) => {
    const ok = await confirmDialog({
      title: '删除真题',
      message: `确定删除「${item.question.slice(0, 30)}…」这道真题？`,
      confirmLabel: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await fetch(`/api/questions?id=${item.id}`, { method: 'DELETE' })
      toast.success('已删除')
      load()
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div className="space-y-4">
      {/* 导入区 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm">🔍 联网导入真题</h3>
          <span className="text-xs text-muted-foreground">已导入 {total} 道</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={importSubject}
            onChange={(e) => setImportSubject(e.target.value)}
            className="h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm"
          >
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            {subjects.length === 0 && <option value="">请先设置目标科目</option>}
          </select>
          <input
            type="number"
            value={importYear}
            onChange={(e) => setImportYear(e.target.value)}
            placeholder="年份(可选)"
            min={2000}
            max={2030}
            className="h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm"
          />
          <input
            type="text"
            value={importKeywords}
            onChange={(e) => setImportKeywords(e.target.value)}
            placeholder="关键词(可选)"
            className="h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm"
          />
          <select
            value={importCount}
            onChange={(e) => setImportCount(+e.target.value)}
            className="h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm"
          >
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} 题</option>)}
          </select>
        </div>
        <Button
          onClick={handleImport}
          disabled={importing || !importSubject || subjects.length === 0}
          className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all"
        >
          {importing ? '联网搜题中（需 AI 提取，约 1 分钟）...' : '🔍 联网搜索并导入真题'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          需要已配置 AI（设置 → AI 配置）；搜索并提取题目后自动入库，可到练习页用「真题练习」模式刷题。题目来源于网络，请核对准确性。
        </p>
      </div>

      {/* 科目计数 */}
      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubjectFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              subjectFilter === '' ? 'bg-brand text-brand-foreground border-brand' : 'border-border/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            全部 ({total})
          </button>
          {Object.entries(counts).map(([s, c]) => (
            <button
              key={s}
              onClick={() => setSubjectFilter(subjectFilter === s ? '' : s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                subjectFilter === s ? 'bg-brand text-brand-foreground border-brand' : 'border-border/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {s} ({c})
            </button>
          ))}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-5xl mb-4">📚</div>
          <p className="font-medium">还没有导入真题</p>
          <p className="text-sm mt-1">用上方「联网搜索并导入真题」获取真实考题，或先到练习页体验其他模式</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <div key={q.id} className="p-4 rounded-2xl border border-border/50 bg-card hover:shadow-sm transition-shadow">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-medium bg-brand-muted text-brand px-2 py-0.5 rounded">{q.subject}</span>
                <span className="text-xs text-muted-foreground">{q.year}年</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{q.type === 'choice' ? '选择题' : '简答题'}</span>
                {q.sourceName && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={q.source}>来源：{q.sourceName}</span>
                )}
              </div>
              <p className="text-sm text-foreground/90 line-clamp-2">{q.question}</p>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex gap-2">
                  <Link
                    href={`/practice?mode=exam_questions&subject=${encodeURIComponent(q.subject)}`}
                    className="text-xs text-brand hover:underline"
                  >
                    ▶ 用此科目刷题
                  </Link>
                  {q.source && (
                    <a href={q.source} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline truncate max-w-[200px]">
                      查看来源
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(q)}
                  className="text-xs text-destructive hover:underline shrink-0"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
