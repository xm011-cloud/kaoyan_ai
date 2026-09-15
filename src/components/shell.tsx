'use client'

import { Header } from '@/components/header'
import { ActivityBar } from '@/components/activity-bar'
import { MobileNav } from '@/components/mobile-nav'
import { PomodoroEngine } from '@/components/pomodoro-engine'
import { AiWorkspace } from '@/components/ai-floating'
import { AiWorkspaceProvider } from '@/components/ai-workspace-context'
import { StudyContextProvider } from '@/components/study-context'
import { OfflineBanner } from '@/components/offline-banner'
import { SwUpdateNotice } from '@/components/sw-update-notice'
import { WorkspaceSidebar } from '@/components/workspace-sidebar'
import { useUIStore } from '@/stores/ui-store'
import { Maximize2, Minimize2 } from 'lucide-react'

/**
 * OS 外壳布局 — Apple HIG compliant
 *
 * Principles applied:
 * - Clarity: single Header replaces TopBar+TabBar
 * - Deference: minimal chrome, content takes full height
 * - Depth: header floats subtly above content
 *
 * ┌─ Header (h-12) ───────────────────────────────┐
 * ├─ Content (flex-1) ─────────────────────────────┤
 * ├─ ActivityBar (conditional) ────────────────────┤
 * └─ MobileNav (lg:hidden) ────────────────────────┘
 */
export function Shell({
  children,
  daysLeft,
  daysLabel,
}: {
  children: React.ReactNode
  daysLeft: number
  daysLabel?: string
}) {
  const focusMode = useUIStore((state) => state.workspaceFocusMode)
  const toggleFocusMode = useUIStore((state) => state.toggleWorkspaceFocusMode)
  return (
    <StudyContextProvider>
    <AiWorkspaceProvider>
      <div className="h-dvh flex bg-background pt-[env(safe-area-inset-top)]">
        <PomodoroEngine />
        <SwUpdateNotice />
        {!focusMode && <WorkspaceSidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 状态提示、页头、内容和移动端导航必须纵向排列；不能作为工作台横向列。 */}
          <OfflineBanner />
          {!focusMode && <Header daysLeft={daysLeft} daysLabel={daysLabel} />}
          {/* AI 工作区是同一 flex 布局的一列，展开时主内容真实收缩而非被遮挡。 */}
          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto">
              <button
                type="button"
                onClick={toggleFocusMode}
                className="fixed right-4 top-4 z-40 hidden h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card/90 px-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground lg:flex"
                aria-label={focusMode ? '退出专注视图' : '进入专注视图'}
              >
                {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {focusMode ? '退出专注' : '专注视图'}
              </button>
              {children}
            </main>
            <AiWorkspace />
          </div>
          {/* Desktop: activity appears at the bottom of the canvas. Mobile: navigation stays at the bottom. */}
          <div className="hidden lg:block">
            <ActivityBar />
          </div>
          <div className="lg:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </AiWorkspaceProvider>
    </StudyContextProvider>
  )
}
