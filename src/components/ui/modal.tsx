'use client'

import { Dialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_STYLES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[min(24rem,92vw)]',
  md: 'max-w-[min(32rem,92vw)]',
  lg: 'max-w-[min(48rem,92vw)]',
  xl: 'max-w-[min(64rem,92vw)]',
}

/** 统一模态框：base-ui Dialog 提供焦点圈闭、Esc 关闭、遮罩、ARIA 标注 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-[81] flex w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col outline-none',
            'rounded-2xl border border-border/50 bg-card shadow-xl',
            'max-h-[90vh]',
            SIZE_STYLES[size],
            className
          )}
        >
          {(title || description) && (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
              <div className="min-w-0">
                {title && <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>}
                {description && (
                  <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label="关闭"
                className="shrink-0 text-xl leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                ✕
              </Dialog.Close>
            </div>
          )}
          {children && <div className="flex-1 overflow-y-auto p-5">{children}</div>}
          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border/50 px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
