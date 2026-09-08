'use client'

import { createContext, useContext, useState } from 'react'
import { useUIStore } from '@/stores/ui-store'

type WorkspaceWidth = 'normal' | 'wide'

interface AiWorkspaceState {
  open: boolean
  width: WorkspaceWidth
  setOpen: (open: boolean) => void
  toggle: () => void
  toggleWidth: () => void
  requestHelp: (prompt: string) => void
  requestedPrompt: string | null
  clearRequestedPrompt: () => void
}

const AiWorkspaceContext = createContext<AiWorkspaceState | null>(null)

/**
 * AI 工作区由 Shell 承载而不是页面悬浮层承载：打开后为主内容让出真实布局空间。
 */
export function AiWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const open = useUIStore((state) => state.aiWorkspaceOpen)
  const width = useUIStore((state) => state.aiWorkspaceWidth) as WorkspaceWidth
  const setOpen = useUIStore((state) => state.setAiWorkspaceOpen)
  const toggleWidth = useUIStore((state) => state.toggleAiWorkspaceWidth)
  const [requestedPrompt, setRequestedPrompt] = useState<string | null>(null)

  return (
    <AiWorkspaceContext.Provider value={{
      open,
      width,
      setOpen,
      toggle: () => setOpen(!open),
      toggleWidth,
      requestHelp: (prompt) => { setRequestedPrompt(prompt); setOpen(true) },
      requestedPrompt,
      clearRequestedPrompt: () => setRequestedPrompt(null),
    }}>
      {children}
    </AiWorkspaceContext.Provider>
  )
}

export function useAiWorkspace() {
  const state = useContext(AiWorkspaceContext)
  if (!state) throw new Error('useAiWorkspace 必须在 AiWorkspaceProvider 内使用')
  return state
}
