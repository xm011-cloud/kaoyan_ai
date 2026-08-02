'use client'

import { Header } from '@/components/header'
import { ActivityBar } from '@/components/activity-bar'
import { MobileNav } from '@/components/mobile-nav'
import { PomodoroEngine } from '@/components/pomodoro-engine'

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
}: {
  children: React.ReactNode
  daysLeft: number
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PomodoroEngine />
      <Header daysLeft={daysLeft} />
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
