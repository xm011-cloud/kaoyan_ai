'use client'

import type { AggregatedEntry, MergedField } from '@/lib/admission'
import { toScoreTable } from '@/lib/admission'

/**
 * 分数线对比表：行=年份，列=科目（并集），单元格=多来源合并值。
 * 一致 → 共识值（多来源标注 ×N）；冲突 → 各值并排（琥珀色提示）。
 * 每行带 👍/⚠️（作用于该年该专业的 score_line 聚合组）与来源数；被质疑/驳回组置灰。
 */
const BAD_STATUS = new Set(['rejected', 'disputed'])

function CellValue({ field }: { field?: MergedField<number | string> }) {
  if (!field || field.variants.length === 0) {
    return <span className="text-muted-foreground/50">—</span>
  }
  if (field.agreed && field.value != null) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="font-semibold">{field.value}</span>
        {field.variants.length > 1 && (
          <span
            className="text-[9px] text-muted-foreground"
            title={`${field.variants.length} 个来源一致`}
          >
            ×{field.variants.length}
          </span>
        )}
      </span>
    )
  }
  return (
    <span
      className="text-[11px] text-amber-600 dark:text-amber-400"
      title="多来源数据不一致，请核实"
    >
      {field.variants.map((v, i) => (
        <span key={i} className="whitespace-nowrap">
          {i > 0 && <span className="mx-0.5 text-muted-foreground/50">/</span>}
          {v.value}
        </span>
      ))}
    </span>
  )
}

export function ScoreTable({
  entries,
  showMajor = false,
  onFeedback,
}: {
  /** 同一专业的 score_line 聚合条目（可跨年份） */
  entries: AggregatedEntry[]
  showMajor?: boolean
  onFeedback?: (entry: AggregatedEntry, type: 'vouch' | 'dispute') => void
}) {
  const data = toScoreTable(entries)
  if (data.years.length === 0) return null
  const entryByYear = new Map(entries.map((e) => [e.year, e]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border/60">
            <th className="py-2 pr-3 font-medium text-left">年份</th>
            {data.subjects.map((s) => (
              <th key={s} className="py-2 px-2 font-medium text-center">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.years.map((y) => {
            const entry = entryByYear.get(y)
            const bad = entry && BAD_STATUS.has(entry.mergedStatus)
            return (
              <tr
                key={y}
                className={`border-b border-border/30 align-top ${bad ? 'opacity-50' : ''}`}
              >
                <td className="py-2.5 pr-3">
                  <div className="font-medium">
                    {showMajor && entry?.major ? `${entry.major} · ` : ''}
                    {y} 年
                  </div>
                  {entry && (
                    <div className="flex items-center gap-1 mt-1 text-[11px]">
                      <span className="text-muted-foreground">{entry.sourceCount} 来源</span>
                      {onFeedback && (
                        <>
                          <button
                            onClick={() => onFeedback(entry, 'vouch')}
                            className={`px-1.5 py-0.5 rounded-full border text-[11px] transition-colors ${
                              entry.myFeedback === 'vouch'
                                ? 'bg-success/15 border-success/40 text-success'
                                : 'border-border/60 text-muted-foreground hover:bg-muted'
                            }`}
                            title="认同此数据"
                          >
                            👍{entry.vouchCount > 0 ? entry.vouchCount : ''}
                          </button>
                          <button
                            onClick={() => onFeedback(entry, 'dispute')}
                            className={`px-1.5 py-0.5 rounded-full border text-[11px] transition-colors ${
                              entry.myFeedback === 'dispute'
                                ? 'bg-warning/15 border-warning/40 text-warning'
                                : 'border-border/60 text-muted-foreground hover:bg-muted'
                            }`}
                            title="质疑此数据"
                          >
                            ⚠️{entry.disputeCount > 0 ? entry.disputeCount : ''}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
                {data.subjects.map((s) => (
                  <td key={s} className="py-2.5 px-2 text-center">
                    <CellValue field={data.cells[y]?.[s]} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
