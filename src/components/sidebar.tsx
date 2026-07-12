'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navItems } from '@/lib/nav'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop 侧边栏 */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-56 border-r bg-white dark:bg-gray-900 dark:border-gray-800 flex-col">
        <div className="px-5 py-4 border-b dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-bold text-lg">AI 考研助手</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

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

      {/* Mobile 底部 TabBar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t dark:border-gray-800 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500'
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.shortLabel}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
