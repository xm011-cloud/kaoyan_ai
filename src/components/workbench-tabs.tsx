'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { defaultNavGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'

/**
 * 顶部 Tab 栏 — OS 外壳第 2 层
 * 显示用户配置的分组导航为横向 tabs
 */
export function WorkbenchTabs() {
  const pathname = usePathname()
  const uiGroups = useUIStore((s) => s.navGroups)

  // Build flat list of visible group items as tabs
  const groups = defaultNavGroups
    .filter((dg) => {
      const ui = uiGroups.find((g) => g.id === dg.id)
      return ui?.visible ?? true
    })
    .map((dg) => {
      const ui = uiGroups.find((g) => g.id === dg.id)
      return {
        ...dg,
        items: dg.items.filter((item) => {
          const uiItem = ui?.items.find((i) => i.href === item.href)
          return uiItem?.visible ?? true
        }),
      }
    })
    .filter((g) => g.items.length > 0)

  // Build tabs: each group's first item, plus all remaining items
  const tabs: { href: string; icon: string; label: string }[] = []
  for (const g of groups) {
    // Group icon/label as first tab, linking to first visible item
    if (g.items.length > 0) {
      tabs.push({ href: g.items[0].href, icon: g.icon, label: g.label })
    }
    // Remaining items as their own tabs
    for (const item of g.items.slice(1)) {
      tabs.push({ href: item.href, icon: item.icon, label: item.label })
    }
  }

  // Limit to 6 tabs on mobile, 8 on desktop
  const maxTabs = typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 8
  const visibleTabs = tabs.slice(0, maxTabs)

  return (
    <div className="shrink-0 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm overflow-x-auto">
      <div className="flex items-center px-3 lg:px-5 gap-0.5 min-w-0">
        {visibleTabs.map((tab) => {
          const isActive =
            pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href + '/'))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          )
        })}
        {tabs.length > maxTabs && (
          <Link
            href="/settings"
            className="flex items-center gap-1 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
          >
            <span className="text-sm">⋯</span>
            <span className="hidden sm:inline">更多</span>
          </Link>
        )}
      </div>
    </div>
  )
}
