'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseAdmissionSeedText, type SeedRowInput } from '@/lib/admission'

const EXAMPLE = `# 院校 / 专业 / 年份 / 分类 / 来源 / 数据（键:值 空格分隔，Tab 或 | 分隔字段）
浙江大学	计算机科学与技术	2025	score_line	研招网	总分:350 政治:60 英语:60 数学:90 专业课:90
浙江大学	计算机科学与技术	2024	score_line	研招网	总分:345 政治:58 英语:58 数学:88 专业课:88
浙江大学	软件工程	2025	score_line	研招网	总分:348 政治:60 英语:60 数学:90 专业课:90
北京大学	计算机科学与技术	2025	enrollment	北大研招网	招生人数:60 报考人数:420
北京大学	计算机科学与技术	2025	subjects	北大研招网	科目:思想政治 科目:英语一 科目:数学一 科目:408计算机学科专业基础`

/**
 * 管理端「院校数据补全」：粘贴多行数据 → 解析预览 → 批量导入（verified）。
 * 数据来源建议：研招网 / 各校研招办 / 权威聚合站，仅填真实数据。
 */
export default function DataSeed() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<SeedRowInput[] | null>(null)
  const [result, setResult] = useState<{ saved: number; skipped: number; errors: string[]; total: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const parse = () => {
    setPreview(parseAdmissionSeedText(text))
    setResult(null)
  }

  const submit = async () => {
    if (!preview || preview.length === 0) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/admission-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '导入失败')
      setResult(data)
    } catch (e) {
      setResult({ saved: 0, skipped: 0, total: 0, errors: [e instanceof Error ? e.message : '导入失败'] })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5">
        <h3 className="text-sm font-semibold">🏫 院校数据补全（批量导入）</h3>
        <p className="text-xs text-muted-foreground mt-1">
          粘贴多行数据，格式：<code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">院校 / 专业 / 年份 / 分类 / 来源 / 数据</code>。
          数据为「键:值」空格分隔（如 总分:350 政治:60）。导入后标记为 ✅已验证，供所有用户共享。
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null) }}
          rows={10}
          placeholder={EXAMPLE}
          className="mt-3 w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/20 resize-y"
        />
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={parse} disabled={!text.trim()} className="rounded-full">
            🔍 解析预览
          </Button>
          <Button size="sm" onClick={submit} disabled={!preview || preview.length === 0 || submitting} className="rounded-full">
            {submitting ? '导入中…' : `📥 批量导入${preview ? `（${preview.length} 行）` : ''}`}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5">
          <p className="text-sm font-medium">解析出 {preview.length} 行</p>
          <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
            {preview.slice(0, 50).map((r, i) => (
              <div key={i} className="text-xs text-muted-foreground flex gap-2 border-b border-border/30 py-1">
                <span className="font-medium text-foreground shrink-0">{r.university}</span>
                <span className="shrink-0">{r.major}</span>
                <span className="shrink-0">{r.year}</span>
                <span className="shrink-0 text-brand">{r.category}</span>
                <span className="truncate">{JSON.stringify(r.data)}</span>
                <span className="shrink-0 text-[10px]">{r.source}</span>
              </div>
            ))}
            {preview.length > 50 && <p className="text-xs text-muted-foreground">… 共 {preview.length} 行</p>}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5 space-y-2">
          <p className="text-sm font-medium">
            ✅ 导入完成：新增 <span className="text-success font-bold">{result.saved}</span> 条，跳过重复
            {result.skipped > 0 ? ` ${result.skipped}` : ''} 条
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-500 space-y-1">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
