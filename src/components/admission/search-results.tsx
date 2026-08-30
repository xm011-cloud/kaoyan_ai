'use client'

import { useState } from 'react'
import type { AggregatedEntry } from '@/lib/admission'
import { ScoreTable } from './score-table'
import { EntryView } from './entry-view'

const CAT_TABS = [
  { id: 'score_line', label: '📊 分数线' },
  { id: 'enrollment', label: '📋 招生' },
  { id: 'subjects', label: '📚 科目' },
  { id: 'notes', label: '📝 其他' },
]

function groupByMajor(entries: AggregatedEntry[]): Map<string, AggregatedEntry[]> {
  const m = new Map<string, AggregatedEntry[]>()
  for (const e of entries) {
    const list = m.get(e.major) || []
    list.push(e)
    m.set(e.major, list)
  }
  return m
}

/**
 * 搜索结果聚合展示：分类 Tab + 分数线对比表 + 条目卡。
 * 分数线按专业分组各一张对比表；招生/科目/其他按专业分组列出条目卡。
 */
export function SearchResults({
  entries,
  onFeedback,
  onOpenRaw,
}: {
  entries: AggregatedEntry[]
  onFeedback: (entry: AggregatedEntry, type: 'vouch' | 'dispute') => void
  onOpenRaw?: () => void
}) {
  const [cat, setCat] = useState('score_line')
  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        知识库中暂无该院校数据，点击下方「联网搜索并入库」获取。
      </p>
    )
  }

  const active =
    cat === 'notes'
      ? entries.filter((e) => e.category === 'tuition' || e.category === 'notes')
      : entries.filter((e) => e.category === cat)
  const byMajor = groupByMajor(active)

  return (
    <div className="space-y-4">
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

      {byMajor.size === 0 && (
        <p className="text-sm text-muted-foreground">该分类暂无数据。</p>
      )}

      {Array.from(byMajor.entries()).map(([major, es]) => (
        <div key={major} className="space-y-2">
          <h4 className="text-sm font-semibold">{major}</h4>
          {cat === 'score_line' ? (
            <div className="bg-card rounded-xl border border-border/50 p-3">
              <ScoreTable entries={es} onFeedback={onFeedback} />
            </div>
          ) : (
            <div className="space-y-2">
              {es.map((e) => (
                <EntryView key={e.key} entry={e} onFeedback={onFeedback} />
              ))}
            </div>
          )}
        </div>
      ))}

      {onOpenRaw && (
        <button
          onClick={onOpenRaw}
          className="text-xs text-blue-600 hover:underline"
        >
          🔗 查看原始搜索结果 (点击展开)
        </button>
      )}
    </div>
  )
}
