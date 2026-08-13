import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** 右侧操作区（按钮/筛选器等） */
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/** 统一页面标题区：标题 + 副标题 + 右侧操作，消除各页样式漂移 */
export function PageHeader({
  title,
  subtitle,
  action,
  align = 'left',
  className,
}: PageHeaderProps) {
  if (align === 'center') {
    return (
      <div className={cn('text-center', className)}>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
