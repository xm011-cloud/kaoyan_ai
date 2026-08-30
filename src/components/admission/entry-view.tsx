'use client'

import { useState } from 'react'
import type { AggregatedEntry, MergedField } from '@/lib/admission'

/** 状态徽标 */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  verified: { label: '✅ 已验证', cls: 'text-success border-success/30 bg-success/10' },
  unverified: { label: '待核实', cls: 'text-muted-foreground border-border/60 bg-muted/40' },
  disputed: { label: '⚠️ 有质疑', cls: 'text-warning border-warning/40 bg-warning/10' },
  rejected: { label: '❌ 已驳回', cls: 'text-destructive border-destructive/40 bg-destructive/10' },
}

const CATEGORY_LABEL: Record<string, string> = {
  enrollment: '📋 招生',
  subjects: '📚 考试科目',
  tuition: '💰 学费',
  notes: '📝 其他信息',
}

function FieldValue({ label, field }: { label: string; field?: MergedField<number | string> }) {
  if (!field || field.variants.length === 0) return null
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
      <div className="text-lg font-bold">
        {field.agreed && field.value != null ? (
          field.value
        ) : (
          <span className="text-amber-600 dark:text-amber-400 text-sm" title="多来源数据不一致">
            {field.variants.map((v, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 && <span className="mx-0.5 text-muted-foreground/50">/</span>}
                {v.value}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

/**
 * 单条聚合条目卡片（招生 / 科目 / 学费 / 其他）。
 * 分数线走 ScoreTable（对比表），这里处理非 score_line 分类。
 */
export function EntryView({
  entry,
  onFeedback,
}: {
  entry: AggregatedEntry
  onFeedback?: (entry: AggregatedEntry, type: 'vouch' | 'dispute') => void
}) {
  const [showSources, setShowSources] = useState(false)
  const status = STATUS_META[entry.mergedStatus] || STATUS_META.unverified
  const bad = entry.mergedStatus === 'rejected' || entry.mergedStatus === 'disputed'
  const d = entry.data || {}

  return (
    <div className={`border border-border/50 rounded-xl p-4 ${bad ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{CATEGORY_LABEL[entry.category] || '📝 其他信息'}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
          <span className="text-[10px] text-muted-foreground">{entry.sourceCount} 来源</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onFeedback && (
            <>
              <button
                onClick={() => onFeedback(entry, 'vouch')}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  entry.myFeedback === 'vouch'
                    ? 'bg-success/15 border-success/40 text-success'
                    : 'border-border/60 text-muted-foreground hover:bg-muted'
                }`}
                title="认同此数据"
              >
                👍 {entry.vouchCount > 0 ? entry.vouchCount : ''}
              </button>
              <button
                onClick={() => onFeedback(entry, 'dispute')}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  entry.myFeedback === 'dispute'
                    ? 'bg-warning/15 border-warning/40 text-warning'
                    : 'border-border/60 text-muted-foreground hover:bg-muted'
                }`}
                title="质疑此数据"
              >
                ⚠️ {entry.disputeCount > 0 ? entry.disputeCount : ''}
              </button>
            </>
          )}
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-xs px-2 py-1 rounded-full border border-border/60 text-muted-foreground hover:bg-muted"
          >
            {showSources ? '收起来源' : `查看来源 (${entry.sourceCount})`}
          </button>
        </div>
      </div>

      {entry.category === 'enrollment' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FieldValue label="招生人数" field={(d.fields as { enrollmentQuota?: MergedField<number> })?.enrollmentQuota as MergedField<number>} />
          <FieldValue label="报考人数" field={(d.fields as { applicants?: MergedField<number> })?.applicants as MergedField<number>} />
        </div>
      )}

      {entry.category === 'subjects' && Array.isArray(d.subjects) && (
        <div className="flex flex-wrap gap-1.5">
          {(d.subjects as { name: string; sourceCount: number }[]).map((s) => (
            <span key={s.name} className="text-xs bg-muted/60 rounded-lg px-2.5 py-1 border border-border/40">
              {s.name}
              {s.sourceCount > 1 && (
                <span className="text-[10px] text-muted-foreground ml-1">×{s.sourceCount}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {entry.category === 'tuition' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md">
          <FieldValue label="学费" field={d.tuition as MergedField<number | string>} />
        </div>
      )}

      {Array.isArray(d.notes) && (d.notes as string[]).length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {(d.notes as string[]).map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}

      {showSources && entry.sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
          {entry.sources.map((s) => {
            const st = STATUS_META[s.verifyStatus] || STATUS_META.unverified
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <a
                  href={s.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate max-w-[70%]"
                >
                  {s.source}
                </a>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${st.cls}`}>{st.label}</span>
                {(s.vouchCount > 0 || s.disputeCount > 0) && (
                  <span className="text-muted-foreground shrink-0">
                    {s.vouchCount > 0 ? `👍${s.vouchCount}` : ''}
                    {s.disputeCount > 0 ? ` ⚠️${s.disputeCount}` : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
