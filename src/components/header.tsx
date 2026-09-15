'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { formatTime } from '@/lib/time-utils'
import { getVisibleGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import { clearClientStateOnLogout } from '@/lib/clear-client-state'
import { useAiWorkspace } from '@/components/ai-workspace-context'
import { Bot, CalendarDays, Menu, Settings2 } from 'lucide-react'

/**
 * 统一头部 — 合并了旧 TopBar + WorkbenchTabs
 *
 * ┌─ [🎓 ▸] [学习概览] [今日学习] [练习备考] [知识库] [设置] ──── 🍅 12:34 ⚙️ ─┐
 * └─ 桌面端：logo + tabs + 活动状态 + 设置
 *    移动端：logo + 活动 + 设置（tabs 通过底部 MobileNav 访问）
 */
export function Header({ daysLeft, daysLabel }: { daysLeft: number; daysLabel?: string }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const pomodoro = usePomodoroStore()
  const uiGroups = useUIStore((s) => s.navGroups)
  const aiWorkspace = useAiWorkspace()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  // 可见分组（统一走 getVisibleGroups，避免各处重复过滤）
  const visibleGroups = getVisibleGroups(uiGroups)

  // 桌面 tab：可见分组中排除 tab:false（如"设置"组用 ⚙️ 入口）；tab 跳转 = 组首项
  const groups = visibleGroups
    .filter((dg) => dg.tab !== false)
    .map((dg) => ({ ...dg, firstItem: dg.items[0] }))
    .slice(0, 6)

  // slide-over 菜单：所有可见分组（含设置组）
  const menuGroups = visibleGroups
  const mobileTitle = visibleGroups
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)))
    ?.label ?? '学习'

  return (
    <>
      {/* ── Header bar ── */}
      <header className="shrink-0 h-12 border-b bg-card/95 backdrop-blur-sm flex items-center gap-1 px-2 lg:px-4 z-50 relative">
        {/* Logo + menu */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center gap-1 rounded-md hover:bg-muted transition-colors lg:hidden"
          aria-label="打开导航"
          aria-expanded={menuOpen}
        >
          <Menu className="h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold">C6</span>
        </button>
        <span className="min-w-0 truncate text-sm font-medium lg:hidden">{mobileTitle}</span>

        {/* Desktop tabs */}
        <nav className="hidden items-center h-full ml-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => {
            const href = g.firstItem?.href || '/dashboard'
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={g.id}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-full shrink-0 text-[13px] font-medium border-b-[3px] transition-colors',
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
        <span className="hidden xl:block text-xs text-muted-foreground mr-2 shrink-0 whitespace-nowrap">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />{dateStr}{daysLabel || (daysLeft > 0 ? ` · ${daysLeft}天` : '')}
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

        </div>

        {/* 桌面端 AI 是右侧工作区，不再以悬浮按钮盖住页面内容。 */}
        <button
          onClick={aiWorkspace.toggle}
          className={cn(
            'hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0',
            aiWorkspace.open ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          aria-pressed={aiWorkspace.open}
          title="切换 AI 工作区 (Ctrl+J)"
        >
          <Bot className="h-3.5 w-3.5" aria-hidden />
          <span>AI 工作区</span>
        </button>

        {/* Settings */}
        <Link href="/settings" aria-label="设置" className={cn('flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0', pathname.startsWith('/settings') && 'text-brand bg-brand-muted')}>
          <Settings2 className="h-4 w-4" aria-hidden />
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
              {(daysLabel || daysLeft > 0) && <p className="text-xs text-warning font-medium mt-0.5">{daysLabel || `⏳ 距考试 ${daysLeft} 天`}</p>}
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
              <form
                action="/auth/signout"
                method="post"
                onSubmit={() => {
                  // 登出前清空客户端残留（store/离线队列/SW缓存），避免下一位账号读到本账号数据
                  clearClientStateOnLogout();
                }}
              >
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
