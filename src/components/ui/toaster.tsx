'use client'

import { useToastStore, type ToastType } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-success/30 text-success',
  error: 'border-destructive/30 text-destructive',
  info: 'border-brand/30 text-brand',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          role="status"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto max-w-md rounded-xl border bg-card px-4 py-2.5 text-sm font-medium shadow-lg shadow-black/5',
            TYPE_STYLES[t.type]
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
