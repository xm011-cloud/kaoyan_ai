'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * AI 未配置引导条：显示"AI 未启用"状态 + 跳设置按钮。
 * 用于 chat / 浮窗等 AI 入口，未配置时前置提示，而不是点进去才报错。
 */
export function AiConfigBanner({
  className,
  compact,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🔑</span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">AI 未启用</p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5">
                配置 API Key 后开启 AI 对话、周报、计划生成等功能；不配置不影响打卡、番茄钟、错题本等其他功能
              </p>
            )}
          </div>
        </div>
        <Link
          href="/settings"
          className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors"
        >
          去配置 →
        </Link>
      </div>
    </div>
  )
}
