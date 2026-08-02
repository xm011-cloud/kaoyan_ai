'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { defaultNavGroups, type NavItem } from '@/lib/nav'
import { useUIStore, type NavGroupItem } from '@/stores/ui-store'

/**
 * 分组 Sidebar
 * 合并 defaultNavGroups（结构）与 ui-store 中的 navGroups（可见性偏好）
 */

export function Sidebar() {
  const pathname = usePathname()
  const uiNavGroups = useUIStore((s) => s.navGroups)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Merge: use defaultNavGroups for structure (labels/icons), ui-store for visibility
  const effectiveGroups = defaultNavGroups.map((defaultGroup) => {
    const uiGroup = uiNavGroups.find((g) => g.id === defaultGroup.id)
    return {
      ...defaultGroup,
      visible: uiGroup?.visible ?? true,
      items: defaultGroup.items.map((item) => {
        const uiItem: NavGroupItem | undefined = uiGroup?.items.find(
          (i: NavGroupItem) => i.href === item.href
        )
        return { ...item, visible: uiItem?.visible ?? true }
      }),
    }
  })

  const visibleGroups = effectiveGroups.filter((g) => g.visible)

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <>
      {/* Desktop 分组侧边栏 */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-56 border-r bg-white dark:bg-gray-900 dark:border-gray-800 flex-col">
        {/* 标题 */}
        <div className="px-5 py-4 border-b dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-bold text-lg">AI 考研助手</span>
          </Link>
        </div>

        {/* 分组导航 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.id)
            const visibleItems = group.items.filter((i) => i.visible)

            return (
              <div key={group.id} className="mb-1">
                {/* 分组标题 */}
                <button
                  onClick={() => toggleCollapse(group.id)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <span>{group.icon}</span>
                  <span className="flex-1 text-left">{group.label}</span>
                  <span
                    className={cn(
                      'text-[10px] transition-transform',
                      !isCollapsed && 'rotate-90'
                    )}
                  >
                    ▶
                  </span>
                </button>

                {/* 分组项 */}
                {!isCollapsed && (
                  <div className="space-y-0.5 px-3">
                    {visibleItems.map((item: NavItem & { visible: boolean }) => {
                      const isActive =
                        pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                          )}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* 底部 */}
        <div className="px-5 py-3 border-t dark:border-gray-800">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span>🚪</span>
              <span>退出登录</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile 底部 TabBar — 最多 5 个分组入口 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t dark:border-gray-800 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {visibleGroups.slice(0, 5).map((group) => {
            const firstItem = group.items.find((i) => i.visible)
            const label = firstItem?.shortLabel || group.label
            const isActive = firstItem
              ? pathname === firstItem.href || pathname.startsWith(firstItem.href + '/')
              : false
            return (
              <Link
                key={group.id}
                href={firstItem?.href || '/dashboard'}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500'
                )}
              >
                <span className="text-lg">{group.icon}</span>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
