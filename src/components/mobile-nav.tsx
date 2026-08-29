'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getVisibleGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { useKeyboardOpen } from '@/hooks/use-keyboard-open'
import { formatTime } from '@/lib/time-utils'

/**
 * 移动端统一底部栏
 *
 * 两种模式自动切换：
 * - 默认模式：5 分组图标 + 快速操作
 * - 活动模式：番茄钟进度 + 练习进度（替换 tab 栏，节省空间）
 */
export function MobileNav() {
  const pathname = usePathname()
  const uiGroups = useUIStore((s) => s.navGroups)
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()
  const storePause = usePomodoroStore((s) => s.pause)
  const storeResume = usePomodoroStore((s) => s.resume)
  const storeReset = usePomodoroStore((s) => s.reset)

  const hasActivity = pomodoro.isRunning || !!practice.activeSessionId

  // 键盘弹出时隐藏底部导航（避免它随布局缩放悬浮在键盘上方，遮挡输入区）
  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null

  const groups = getVisibleGroups(uiGroups).slice(0, 5)

  // Pomodoro progress
  const total = pomodoro.totalSeconds || 1
  const remaining = pomodoro.remainingSeconds
  const pct = pomodoro.isRunning ? ((total - remaining) / total) * 100 : 0

  return (
    <nav className="lg:hidden shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-xl safe-area-bottom">
      {hasActivity ? (
        /* ── Active mode: progress + controls ── */
        <div className="flex items-center gap-2 px-2 py-2">
          {pomodoro.isRunning && (
            <div className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border',
              pomodoro.isPaused ? 'border-warning/40 bg-warning/5' : 'border-destructive/20 bg-destructive/5'
            )}>
              <span className="text-xl shrink-0">🍅</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">
                    {pomodoro.isPaused ? '⏸ 已暂停' : '专注中'}
                    {pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}
                  </span>
                  <span className="text-xs font-mono font-bold ml-1">{formatTime(remaining)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', pomodoro.isPaused ? 'bg-warning' : 'bg-destructive')}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Mobile inline controls */}
              <div className="flex items-center gap-1 shrink-0">
                {pomodoro.isPaused ? (
                  <button onClick={storeResume}
                    className="w-8 h-8 rounded-full bg-success/20 text-success flex items-center justify-center active:scale-[0.92] transition-all">
                    ▶
                  </button>
                ) : (
                  <button onClick={storePause}
                    className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center active:scale-[0.92] transition-all">
                    ⏸
                  </button>
                )}
                <button onClick={() => {
                  if (pomodoro.startedAt) {
                    fetch('/api/pomodoro/sessions', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: pomodoro.sessionType,
                        plannedMinutes: pomodoro.plannedMinutes,
                        actualSeconds: Math.max(0, pomodoro.totalSeconds - pomodoro.remainingSeconds),
                        status: 'interrupted',
                        startedAt: new Date(pomodoro.startedAt).toISOString(),
                        endedAt: new Date().toISOString(),
                      }),
                    }).catch(() => {})
                  }
                  storeReset()
                }}
                  className="w-8 h-8 rounded-full bg-muted-foreground/10 text-muted-foreground flex items-center justify-center active:scale-[0.92] transition-all">
                  ⏹
                </button>
              </div>
            </div>
          )}

          {practice.activeSessionId && (
            <Link href={`/practice?session=${practice.activeSessionId}`}
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-muted active:scale-[0.98] transition-all">
              <span className="text-xl">✏️</span>
              <div>
                <p className="text-xs font-medium">{practice.activeSubject || '练习中'}</p>
                <p className="text-[10px] text-muted-foreground">第 {practice.currentIndex + 1} 题 · 继续</p>
              </div>
            </Link>
          )}
        </div>
      ) : (
        /* ── Default mode: tabs + quick action ── */
        <div className="flex items-center justify-around h-14">
          {groups.map((group) => {
            const href = group.items[0]?.href || '/dashboard'
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link key={group.id} href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-[0.97]',
                  isActive ? 'text-brand' : 'text-muted-foreground/60'
                )}>
                <span className="text-lg leading-none">{group.icon}</span>
                <span className="text-[10px] font-medium leading-none">{group.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
