'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SchoolSummary } from '@/app/api/admission/library/route'

const SORTS = [
  { id: 'newest', label: '最近更新' },
  { id: 'data', label: '数据最多' },
  { id: 'trust', label: '信任最高' },
]

/**
 * 📚 院校知识库 Tab：浏览社区共享数据（全局 userId:null），筛选（防抖）+ 排序 + 分页。
 * 点击院校 → 跳独立可分享详情页 /admission/library/[school]。
 */
export function LibraryTab() {
  const [uni, setUni] = useState('')
  const [major, setMajor] = useState('')
  const [sort, setSort] = useState('newest')
  const [offset, setOffset] = useState(0)
  // 防抖后的筛选条件（避免每敲一个字就发请求）
  const [query, setQuery] = useState({ uni: '', major: '' })
  const [data, setData] = useState<{ schools: SchoolSummary[]; total: number } | null>(null)
  const [error, setError] = useState('')
  const PAGE = 20

  useEffect(() => {
    const t = setTimeout(() => setQuery({ uni: uni.trim(), major: major.trim() }), 300)
    return () => clearTimeout(t)
  }, [uni, major])

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({
      sort,
      limit: String(PAGE),
      offset: String(offset),
      ...(query.uni ? { university: query.uni } : {}),
      ...(query.major ? { major: query.major } : {}),
    })
    fetch(`/api/admission/library?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { schools: SchoolSummary[]; total: number }) => {
        if (!cancelled) {
          setData(d)
          setError('')
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [query, sort, offset])

  const loading = data === null && !error

  return (
    <div className="space-y-4">
      {/* 筛选 */}
      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold">📚 院校知识库</h3>
          {data && (
            <span className="text-xs text-muted-foreground">
              共 {data.total} 所院校 · 数据来自所有用户搜索/导入自动共享
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={uni}
            onChange={(e) => {
              setUni(e.target.value)
              setOffset(0)
            }}
            placeholder="院校名称（如 北京大学）"
            className="rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            value={major}
            onChange={(e) => {
              setMajor(e.target.value)
              setOffset(0)
            }}
            placeholder="专业（可选）"
            className="rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setOffset(0)
            }}
            className="rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-center text-sm text-muted-foreground py-8">加载知识库…</p>}
      {error && !data && <p className="text-sm text-red-500">{error}</p>}

      {data && data.schools.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          还没有院校数据。去「🔍 搜索」搜一所院校，结果会自动入库与大家共享。
        </div>
      )}

      {data && data.schools.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.schools.map((s) => (
              <Link
                key={s.university}
                href={`/admission/library/${encodeURIComponent(s.university)}`}
                className="bg-card rounded-2xl border border-border/50 p-4 hover:shadow-sm hover:border-border transition-shadow"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold">{s.university}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {s.majorCount} 专业 · {s.yearCount} 年份
                  </span>
                </div>
                {s.latestScore && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {s.latestScore.major} {s.latestScore.year}年：
                    {Object.entries(s.latestScore.scores).map(([k, v]) => (
                      <span key={k} className="ml-2">
                        {k} {v}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{s.sourceCount} 来源</span>
                  {s.vouchCount > 0 && <span className="text-success">👍{s.vouchCount}</span>}
                  {s.disputeCount > 0 && <span className="text-warning">⚠️{s.disputeCount}</span>}
                </div>
              </Link>
            ))}
          </div>

          {data.total > PAGE && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
                disabled={offset === 0}
                className="px-4 py-2 rounded-full border border-border/60 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                ◀ 上一页
              </button>
              <span className="text-xs text-muted-foreground">
                {Math.floor(offset / PAGE) + 1} / {Math.ceil(data.total / PAGE)}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE)}
                disabled={offset + PAGE >= data.total}
                className="px-4 py-2 rounded-full border border-border/60 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                下一页 ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
