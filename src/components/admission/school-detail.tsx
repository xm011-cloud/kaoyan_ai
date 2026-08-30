'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { AdmissionEntryView } from '@/lib/admission-server'
import { aggregateRows, type AggregatedEntry, type RawAggRow } from '@/lib/admission'
import { ScoreTable } from './score-table'
import { EntryView } from './entry-view'

const CAT_TABS = [
  { id: 'score_line', label: '📊 分数线' },
  { id: 'enrollment', label: '📋 招生' },
  { id: 'subjects', label: '📚 科目' },
  { id: 'notes', label: '📝 其他' },
]

/**
 * 院校详情页 client 视图：专业选择 + 分类 Tab + 分数线对比表 + 条目卡 + 反馈。
 * 收到 server 页传来的原始条目（按专业分组），本地聚合；反馈后按返回计数回写并重算。
 */
export function SchoolDetailView({
  university,
  majors,
}: {
  university: string
  majors: Record<string, AdmissionEntryView[]>
}) {
  const majorNames = Object.keys(majors)
  const [selectedMajor, setSelectedMajor] = useState(majorNames[0] || '')
  const [cat, setCat] = useState('score_line')
  const [raw, setRaw] = useState<Record<string, AdmissionEntryView[]>>(majors)
  const [submitting, setSubmitting] = useState(false)

  const entries = useMemo<AggregatedEntry[]>(() => {
    const rows = raw[selectedMajor] || []
    return aggregateRows(rows as RawAggRow[])
  }, [raw, selectedMajor])

  const handleFeedback = async (entry: AggregatedEntry, type: 'vouch' | 'dispute') => {
    if (submitting) return
    setSubmitting(true)
    try {
      const results: { action: string; counts?: { vouch: number; dispute: number } }[] = []
      for (const s of entry.sources) {
        const res = await fetch('/api/admission/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admissionInfoId: s.id, type }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '操作失败')
        results.push(data)
      }
      setRaw((prev) => {
        const next: Record<string, AdmissionEntryView[]> = {}
        for (const [m, rows] of Object.entries(prev)) {
          next[m] = rows.map((e) => {
            const idx = entry.sources.findIndex((s) => s.id === e.id)
            if (idx < 0 || !results[idx]) return e
            const r = results[idx]
            return {
              ...e,
              vouchCount: r.counts?.vouch ?? e.vouchCount,
              disputeCount: r.counts?.dispute ?? e.disputeCount,
              myFeedback: r.action === 'removed' ? null : type,
              verifyStatus:
                type === 'dispute'
                  ? 'disputed'
                  : r.action === 'removed' && e.verifyStatus === 'disputed'
                    ? 'unverified'
                    : e.verifyStatus,
            }
          })
        }
        return next
      })
    } catch (e) {
      console.error('feedback failed', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (majorNames.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl">🏫</div>
        <h1 className="text-xl font-bold">{university}</h1>
        <p className="text-sm text-muted-foreground">
          知识库中暂无该院校数据。去「🏫 院校情报」搜索一次，数据会自动入库与大家共享。
        </p>
        <Link
          href="/admission"
          className="inline-flex mt-2 px-4 py-2 rounded-full bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90"
        >
          🔍 去搜索
        </Link>
      </div>
    )
  }

  const active =
    cat === 'notes'
      ? entries.filter((e) => e.category === 'tuition' || e.category === 'notes')
      : entries.filter((e) => e.category === cat)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/admission" className="hover:underline">🏫 院校情报</Link> · 知识库
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{university}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          社区共享数据（{majorNames.length} 个专业 · 多来源可对比），仅供参考，请以官方公布为准。
        </p>
      </div>

      {/* 专业选择 */}
      {majorNames.length > 1 && (
        <div className="flex gap-1 p-1 rounded-xl bg-muted overflow-x-auto">
          {majorNames.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMajor(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedMajor === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* 分类 Tab */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
        {CAT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setCat(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              cat === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active.length === 0 && (
        <p className="text-sm text-muted-foreground">该分类暂无数据。</p>
      )}

      {cat === 'score_line' ? (
        <div className="bg-card rounded-xl border border-border/50 p-3">
          <ScoreTable
            entries={entries.filter((e) => e.category === 'score_line')}
            showMajor
            onFeedback={handleFeedback}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((e) => (
            <EntryView key={e.key} entry={e} onFeedback={handleFeedback} />
          ))}
        </div>
      )}
    </div>
  )
}
