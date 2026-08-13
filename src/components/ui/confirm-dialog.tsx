'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useConfirmStore } from '@/stores/confirm-store'
import { cn } from '@/lib/utils'

/** 全局确认框宿主：根 layout 挂载一次，配合 confirmDialog() 使用 */
export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending)
  const answer = useConfirmStore((s) => s.answer)

  const options = pending?.options

  return (
    <AlertDialog.Root
      open={pending !== null}
      onOpenChange={(open) => {
        // Esc / 遮罩 / 取消 → 视为拒绝
        if (!open) answer(false)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[95] bg-black/40" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[96] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/50 bg-card p-5 shadow-xl outline-none">
          <AlertDialog.Title className="text-lg font-bold">
            {options?.title || '确认操作'}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {options?.message}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-full border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              {options?.cancelLabel || '取消'}
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => answer(true)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium text-white transition-colors',
                options?.danger
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-brand hover:bg-brand/90'
              )}
            >
              {options?.confirmLabel || '确定'}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
