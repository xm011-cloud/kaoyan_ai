'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUIStore } from '@/stores/ui-store'
import { CHANGELOG, LATEST_CHANGELOG_ID } from '@/lib/changelog'

/**
 * 更新告示条（dashboard 顶部）：只在有新版本（最新条目未读）时出现，
 * 可关闭；关闭后记录已读，下次发版新条目出现时再次展示。
 */
export function ChangelogBanner() {
  const lastSeenChangelog = useUIStore((s) => s.lastSeenChangelog)
  const setLastSeenChangelog = useUIStore((s) => s.setLastSeenChangelog)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(lastSeenChangelog !== LATEST_CHANGELOG_ID)
  }, [lastSeenChangelog])

  if (!visible) return null
  const latest = CHANGELOG[0]

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          📢 新更新：{latest.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {latest.items[0]}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href="/changelog"
          className="text-xs rounded-full bg-brand px-3 py-1.5 font-medium text-brand-foreground hover:bg-brand/90 transition-colors"
        >
          查看更新
        </Link>
        <button
          onClick={() => setLastSeenChangelog(LATEST_CHANGELOG_ID)}
          aria-label="关闭更新告示"
          className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
