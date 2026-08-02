'use client'

import { TopBar } from '@/components/top-bar'
import { WorkbenchTabs } from '@/components/workbench-tabs'
import { ActivityBar } from '@/components/activity-bar'
import { MobileNav } from '@/components/mobile-nav'

/**
 * OS 外壳布局
 *
 * ┌─ TopBar (h-12/14) ──────────────────────────┐
 * ├─ WorkbenchTabs (h-9) ────────────────────────┤
 * ├─ Content (flex-1, scroll) ───────────────────┤
 * ├─ ActivityBar (auto-h, when active) ──────────┤
 * └─ MobileNav (lg:hidden, h-14) ────────────────┘
 */
export function Shell({
  children,
  daysLeft,
}: {
  children: React.ReactNode
  daysLeft: number
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Layer 1: Top Bar — always visible */}
      <TopBar daysLeft={daysLeft} />

      {/* Layer 2: Tab Bar — desktop only */}
      <div className="hidden lg:block">
        <WorkbenchTabs />
      </div>

      {/* Layer 3: Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Layer 4: Activity Bar — always visible when active */}
      <ActivityBar />

      {/* Layer 5: Mobile Bottom Nav — 5 group icons */}
      <MobileNav />
    </div>
  )
}
