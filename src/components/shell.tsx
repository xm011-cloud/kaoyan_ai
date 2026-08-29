'use client'

import { Header } from '@/components/header'
import { ActivityBar } from '@/components/activity-bar'
import { MobileNav } from '@/components/mobile-nav'
import { PomodoroEngine } from '@/components/pomodoro-engine'
import { AiFloating } from '@/components/ai-floating'
import { OfflineBanner } from '@/components/offline-banner'
import { SwUpdateNotice } from '@/components/sw-update-notice'

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
  return (
    <div className="h-dvh flex flex-col bg-background pt-[env(safe-area-inset-top)]">
      <PomodoroEngine />
      <AiFloating />
      <OfflineBanner />
      <SwUpdateNotice />
      <Header daysLeft={daysLeft} daysLabel={daysLabel} />
      {/* main 保持块级滚动容器（避免全局 flex 改动影响各页移动端布局）；
          聊天/做题页用 h-full 各自接通内层滚动 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      {/* Desktop: ActivityBar only when active. Mobile: handled inside MobileNav */}
      <div className="hidden lg:block">
        <ActivityBar />
      </div>
      <div className="lg:hidden">
        <MobileNav />
      </div>
    </div>
  )
}
