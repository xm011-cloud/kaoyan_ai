'use client'

import { create } from 'zustand'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 危险操作：确认按钮使用 destructive 色 */
  danger?: boolean
}

export interface PendingConfirm {
  id: string
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

let confirmSeq = 0

interface ConfirmState {
  pending: PendingConfirm | null
  ask: (options: ConfirmOptions) => Promise<boolean>
  answer: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { id: `confirm-${++confirmSeq}`, options, resolve } })
    }),
  answer: (value) => {
    const current = get().pending
    if (!current) return
    set({ pending: null })
    current.resolve(value)
  },
}))

/** promise 式确认框：confirmDialog('确定删除？').then(ok => ...) */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(
    typeof options === 'string' ? { message: options } : options
  )
}
