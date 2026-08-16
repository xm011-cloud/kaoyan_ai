'use client'

import { useEffect, useState } from 'react'

/**
 * SW 版本更新提示：Service Worker 激活并确认是「真升级」（旧缓存存在）后向页面
 * postMessage `app-updated`，这里收到后展示「点击刷新」浮条——让仍开着老页面的用户
 * 能立刻拿到新版（如热修上传按钮）。首次安装不发消息，不打扰新用户。
 */
export function SwUpdateNotice() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'app-updated') setReady(true)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])

  if (!ready) return null

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-xs font-medium shadow-lg hover:opacity-90 transition-opacity whitespace-nowrap"
    >
      🔄 已更新到新版本，点击刷新
    </button>
  )
}
