'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActivityStore } from '@/stores/activity-store'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { formatTime } from '@/lib/time-utils'
import { defaultNavGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

/**
 * 常驻顶部栏 — OS 外壳第 1 层
 * 日期 + 倒计时 + 导航菜单 + 活动标签
 */
export function TopBar({ daysLeft }: { daysLeft: number }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const activities = useActivityStore((s) => s.activities)
  const pomodoro = usePomodoroStore()
  const uiGroups = useUIStore((s) => s.navGroups)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  // Merge nav groups with visibility preferences
  const groups = defaultNavGroups.map((dg) => {
    const ui = uiGroups.find((g) => g.id === dg.id)
    return { ...dg, visible: ui?.visible ?? true }
  }).filter((g) => g.visible)

  // Active activity chips
  const activeList = activities.filter((a) => a.status !== 'completed').slice(0, 2)

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <>
      <header className="shrink-0 h-12 lg:h-14 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex items-center px-3 lg:px-5 gap-3 z-50 relative">
        {/* Logo + Menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
        >
          <span className="text-lg">🎓</span>
          <span className="font-bold text-sm lg:text-base hidden sm:inline">考研助手</span>
          <span className={cn('text-[10px] transition-transform', menuOpen && 'rotate-90')}>▶</span>
        </button>

        {/* Date + Countdown */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 border-l pl-3 ml-1">
          <span>📅 {dateStr}</span>
          {daysLeft > 0 && (
            <span className="text-orange-500 font-medium">⏳ {daysLeft} 天</span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Activity chips */}
        <div className="flex items-center gap-2">
          {activeList.map((a) => (
            <Link
              key={a.id}
              href={a.linkTo || '#'}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors shrink-0',
                a.status === 'running' || a.status === 'in_progress'
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30'
              )}
            >
              <span>{a.icon}</span>
              <span className="hidden md:inline truncate max-w-[100px]">{a.title}</span>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', a.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400')} />
            </Link>
          ))}

          {/* Pomodoro compact display */}
          {pomodoro.isRunning && (
            <div className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border shrink-0',
              pomodoro.isPaused
                ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30'
            )}>
              <span>🍅</span>
              <span className="font-mono font-medium">{formatTime(pomodoro.remainingSeconds)}</span>
              <span className="hidden md:inline">{pomodoro.isPaused ? '⏸️' : ''}</span>
            </div>
          )}
        </div>

        {/* Settings */}
        <Link href="/settings" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
          <span className="text-base">⚙️</span>
        </Link>
      </header>

      {/* Slide-over menu (replaces old sidebar) */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMenuOpen(false)} />
          <div className="fixed left-0 top-12 lg:top-14 bottom-0 z-50 w-64 bg-white dark:bg-gray-900 border-r shadow-xl overflow-y-auto animate-in slide-in-from-left">
            <div className="p-4 space-y-4">
              {groups.map((group) => {
                const visibleItems = group.items.filter((i) => {
                  const uiItem = uiGroups.find((g) => g.id === group.id)?.items.find((ui) => ui.href === i.href)
                  return uiItem?.visible ?? true
                })
                if (visibleItems.length === 0 && group.visible) return null
                const uiGroup = uiGroups.find((g) => g.id === group.id)
                if (uiGroup && !uiGroup.visible) return null

                return (
                  <div key={group.id}>
                    <p className="text-[11px] font-medium text-gray-400 uppercase mb-1.5 px-1">
                      {group.icon} {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                              isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            )}
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <hr className="dark:border-gray-700" />
              <form action="/auth/signout" method="post">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 w-full rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <span>🚪</span> 退出登录
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  )
}
