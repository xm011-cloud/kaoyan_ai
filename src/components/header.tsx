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
 * 统一头部 — 合并了旧 TopBar + WorkbenchTabs
 *
 * ┌─ [🎓 ▸] [学习概览] [今日学习] [练习备考] [知识库] [设置] ──── 🍅 12:34 ⚙️ ─┐
 * └─ 桌面端：logo + tabs + 活动状态 + 设置
 *    移动端：logo + 活动 + 设置（tabs 通过底部 MobileNav 访问）
 */
export function Header({ daysLeft }: { daysLeft: number }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const activities = useActivityStore((s) => s.activities)
  const pomodoro = usePomodoroStore()
  const uiGroups = useUIStore((s) => s.navGroups)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  // Build tabs from visible groups
  const groups = defaultNavGroups
    .filter((dg) => {
      const ui = uiGroups.find((g) => g.id === dg.id)
      return ui?.visible ?? true
    })
    .map((dg) => ({
      ...dg,
      firstItem: dg.items.find((item) => {
        const uiItem = uiGroups.find((g) => g.id === dg.id)?.items.find((i) => i.href === item.href)
        return uiItem?.visible ?? true
      }),
    }))
    .filter((g) => g.firstItem)
    .slice(0, 6)

  const activeList = activities.filter((a) => a.status !== 'completed')

  // Build slide-over menu items
  const menuGroups = defaultNavGroups.map((dg) => {
    const ui = uiGroups.find((g) => g.id === dg.id)
    return {
      ...dg,
      visible: ui?.visible ?? true,
      items: dg.items.filter((item) => {
        const uiItem = ui?.items.find((i) => i.href === item.href)
        return uiItem?.visible ?? true
      }),
    }
  }).filter((g) => g.visible && g.items.length > 0)

  return (
    <>
      {/* ── Header bar ── */}
      <header className="shrink-0 h-12 border-b bg-card/95 backdrop-blur-sm flex items-center gap-1 px-2 lg:px-4 z-50 relative">
        {/* Logo + menu */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md hover:bg-muted transition-colors"
        >
          <span className="text-lg leading-none">🎓</span>
          <span className="font-bold text-sm hidden sm:inline">考研助手</span>
          <span className={cn('text-[9px] text-muted-foreground transition-transform ml-0.5', menuOpen && 'rotate-90')}>▶</span>
        </button>

        {/* Desktop tabs */}
        <nav className="hidden lg:flex items-center h-full ml-2">
          {groups.map((g) => {
            const href = g.firstItem?.href || '/dashboard'
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={g.id}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-full text-[13px] font-medium border-b-[3px] transition-colors',
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-sm">{g.icon}</span>
                <span>{g.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Date (desktop only) */}
        <span className="hidden lg:block text-xs text-muted-foreground mr-2 shrink-0 whitespace-nowrap">
          📅 {dateStr}{daysLeft > 0 ? ` · ⏳ ${daysLeft}天` : ''}
        </span>

        {/* Activity indicators */}
        <div className="flex items-center gap-1.5">
          {pomodoro.isRunning && (
            <Link
              href="/pomodoro"
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium shrink-0 border transition-colors',
                pomodoro.isPaused
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              )}
            >
              <span>🍅</span>
              <span>{formatTime(pomodoro.remainingSeconds)}</span>
              {pomodoro.isPaused && <span className="text-[9px]">⏸</span>}
            </Link>
          )}

          {activeList.filter(a => a.id !== 'pomodoro').slice(0, 1).map((a) => (
            <Link
              key={a.id}
              href={a.linkTo || '#'}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] shrink-0 border transition-colors',
                a.status === 'running' || a.status === 'in_progress'
                  ? 'border-brand/30 bg-brand-muted text-brand'
                  : 'border-warning/40 bg-warning/10 text-warning'
              )}
            >
              <span>{a.icon}</span>
              <span className="hidden md:inline truncate max-w-[80px]">{a.title}</span>
              {a.status === 'running' && <span className="w-1 h-1 rounded-full bg-success animate-pulse" />}
            </Link>
          ))}
        </div>

        {/* Settings */}
        <Link href="/settings" className={cn('p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0', pathname.startsWith('/settings') && 'text-brand bg-brand-muted')}>
          <span className="text-base">⚙️</span>
        </Link>
      </header>

      {/* ── Slide-over menu ── */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="fixed left-0 top-12 bottom-0 z-50 w-64 bg-card border-r shadow-2xl overflow-y-auto animate-in slide-in-from-left">
            {/* User info */}
            <div className="p-4 border-b">
              <p className="text-sm font-semibold">🎓 考研助手</p>
              <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
              {daysLeft > 0 && <p className="text-xs text-warning font-medium mt-0.5">⏳ 距考试 {daysLeft} 天</p>}
            </div>

            <div className="p-3 space-y-3">
              {menuGroups.map((group) => (
                <div key={group.id}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                    {group.icon} {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                            isActive
                              ? 'bg-brand-muted text-brand font-semibold'
                              : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span>{item.label}</span>
                          {isActive && <span className="ml-auto w-1 h-4 rounded-full bg-brand" />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}

              <hr />
              <form action="/auth/signout" method="post">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive w-full rounded-lg hover:bg-muted transition-colors">
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
