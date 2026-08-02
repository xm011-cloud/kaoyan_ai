'use client'

import Link from 'next/link'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { formatTime } from '@/lib/time-utils'
import { cn } from '@/lib/utils'

/**
 * 桌面端常驻底部活动栏 — 有活动时显示进度，无活动时隐藏
 * （移动端由 MobileNav 统一处理）
 */
export function ActivityBar() {
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()

  const hasActivity = pomodoro.isRunning || !!practice.activeSessionId || practice.isGenerating

  // ── Pomodoro progress ──
  const total = pomodoro.totalSeconds || 1
  const remaining = pomodoro.isRunning ? pomodoro.remainingSeconds : 0
  const progress = pomodoro.isRunning ? ((total - remaining) / total) * 100 : 0

  return (
    <div className={cn(
      'shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-xl',
      'safe-area-bottom',
      !hasActivity && 'lg:hidden' // on desktop, hide idle strip (info is in Header)
    )}>
      {hasActivity ? (
        /* ── Active mode: full controls ── */
        <div className="flex items-center gap-3 px-3 lg:px-5 py-2.5 overflow-x-auto">
          {/* Pomodoro */}
          {pomodoro.isRunning && (
            <Link href="/pomodoro"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl border shrink-0 min-w-[180px] hover:shadow-sm active:scale-[0.98] transition-all',
                pomodoro.isPaused
                  ? 'border-warning/40 bg-warning/5'
                  : 'border-destructive/20 bg-destructive/5'
              )}>
              <span className="text-lg">🍅</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {pomodoro.sessionType === 'focus' ? '专注' : pomodoro.sessionType === 'short_break' ? '短休' : '长休'}
                    {pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}
                  </span>
                  <span className="text-xs font-mono font-bold">{formatTime(remaining)}</span>
                </div>
                <div className="w-full h-1 rounded-full bg-muted mt-1 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500',
                    pomodoro.isPaused ? 'bg-warning' : 'bg-destructive'
                  )} style={{ width: `${progress}%` }} />
                </div>
              </div>
              {pomodoro.isPaused && <span className="text-xs text-warning font-medium shrink-0">⏸</span>}
            </Link>
          )}

          {/* Practice */}
          {practice.activeSessionId && (
            <Link href={`/practice?session=${practice.activeSessionId}`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/20 bg-brand-muted shrink-0 hover:shadow-sm active:scale-[0.98] transition-all">
              <span className="text-lg">✏️</span>
              <div>
                <p className="text-xs font-medium">{practice.activeSubject || '练习中'}</p>
                <p className="text-[10px] text-muted-foreground">第 {practice.currentIndex + 1} 题</p>
              </div>
            </Link>
          )}

          {/* AI generating */}
          {practice.isGenerating && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 shrink-0">
              <span className="text-lg animate-pulse">🤖</span>
              <div>
                <p className="text-xs font-medium">AI 出题中</p>
                <p className="text-[10px] text-muted-foreground">请稍候...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Idle mode (mobile only): quick actions strip ── */
        <div className="flex items-center justify-around gap-1 px-2 py-2 lg:hidden">
          <QuickAction href="/pomodoro" icon="🍅" label="专注" />
          <QuickAction href="/practice" icon="✏️" label="练习" />
          <QuickAction href="/chat" icon="💬" label="问答" />
          <QuickAction href="/checkin" icon="✅" label="打卡" />
          <QuickAction href="/materials" icon="📚" label="资料" />
        </div>
      )}
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-muted active:scale-[0.95] transition-all min-w-[44px]"
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </Link>
  )
}
