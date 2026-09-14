'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAiWorkspace } from '@/components/ai-workspace-context'

/**
 * 兼容旧 /chat 链接：AI 的唯一界面是 Shell 内的工作区。
 * 桌面跳回用户离学习主线最近的概览页并展开右栏；移动端工作区会覆盖当前路由。
 */
export function AiWorkspaceRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setOpen } = useAiWorkspace()

  useEffect(() => {
    setOpen(true)
    if (window.matchMedia('(min-width: 1024px)').matches) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('ai', '1')
      router.replace(`/dashboard?${params.toString()}`)
    }
  }, [router, searchParams, setOpen])

  return <div className="workspace-page lg:hidden"><p className="text-sm text-muted-foreground">正在打开 AI 工作区…</p></div>
}
