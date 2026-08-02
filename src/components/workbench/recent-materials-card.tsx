'use client'

import Link from 'next/link'

interface MaterialTrim { id: string; name: string; type: string; createdAt: string }

const icons: Record<string, string> = { pdf: '📄', word: '📝', text: '📃', image: '🖼️', other: '📎' }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function RecentMaterialsCard({ materials }: { materials: MaterialTrim[] }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold">📚 最近资料</h3>
        <Link href="/materials" className="text-xs text-brand font-medium hover:underline">全部 →</Link>
      </div>
      <div className="p-2">
        {materials.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl">📁</span>
            <p className="text-sm text-muted-foreground mt-2">还没有上传资料</p>
            <Link href="/materials" className="inline-block mt-2 text-xs text-brand font-medium hover:underline">
              去上传 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 rounded-xl transition-colors">
                <span className="text-lg">{icons[m.type] || '📎'}</span>
                <span className="text-sm truncate flex-1 font-medium">{m.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(m.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
