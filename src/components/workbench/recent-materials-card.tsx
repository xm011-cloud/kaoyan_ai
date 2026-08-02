'use client'

import Link from 'next/link'

interface MaterialTrim {
  id: string
  name: string
  type: string
  createdAt: string
}

export function RecentMaterialsCard({ materials }: { materials: MaterialTrim[] }) {
  const typeIcon: Record<string, string> = {
    pdf: '📄',
    word: '📝',
    text: '📃',
    image: '🖼️',
    other: '📎',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">最近资料</h3>
        <Link href="/materials" className="text-sm text-blue-500 hover:underline">
          全部资料 →
        </Link>
      </div>
      {materials.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          还没有上传资料，去上传教材或笔记吧
        </p>
      ) : (
        <div className="space-y-2">
          {materials.slice(0, 4).map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5">
              <span className="text-sm">{typeIcon[m.type] || '📎'}</span>
              <span className="text-sm truncate flex-1">{m.name}</span>
              <span className="text-[11px] text-gray-400">
                {relativeTime(m.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}
