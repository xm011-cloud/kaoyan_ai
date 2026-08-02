'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { defaultNavGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'

/**
 * 移动端底部 5Tab 导航
 * 按分组显示，每个分组一个图标
 */
export function MobileNav() {
  const pathname = usePathname()
  const uiGroups = useUIStore((s) => s.navGroups)

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
    .slice(0, 5)

  return (
    <nav className="lg:hidden shrink-0 border-t bg-white dark:bg-gray-900 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {groups.map((group) => {
          const firstItem = group.items[0]
          const href = firstItem?.href || '/dashboard'
          const isActive = firstItem
            ? pathname === firstItem.href || (firstItem.href !== '/dashboard' && pathname.startsWith(firstItem.href + '/'))
            : false
          return (
            <Link
              key={group.id}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              <span className="text-lg">{group.icon}</span>
              <span className="text-[10px] font-medium">{group.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
