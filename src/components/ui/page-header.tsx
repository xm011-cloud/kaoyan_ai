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
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
