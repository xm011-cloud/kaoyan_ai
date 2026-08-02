'use client'

import { Header } from '@/components/header'
import { ActivityBar } from '@/components/activity-bar'
import { MobileNav } from '@/components/mobile-nav'

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
      <Header daysLeft={daysLeft} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <ActivityBar />
      <MobileNav />
    </div>
  )
}
