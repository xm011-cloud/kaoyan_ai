'use client'

import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { formatTime } from '@/lib/time-utils'
import { cn } from '@/lib/utils'

/**
 * 桌面端常驻底部活动栏
 *
 * 番茄钟控制：暂停 / 继续 / 停止（不需要跳转到番茄钟页）
 * 练习：点击跳转到练习页
 */
export function ActivityBar() {
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()
  const storePause = usePomodoroStore((s) => s.pause)
  const storeResume = usePomodoroStore((s) => s.resume)
  const storeReset = usePomodoroStore((s) => s.reset)

  const hasActivity = pomodoro.isRunning || !!practice.activeSessionId || practice.isGenerating

  const total = pomodoro.totalSeconds || 1
  const remaining = pomodoro.isRunning ? pomodoro.remainingSeconds : 0
  const progress = pomodoro.isRunning ? ((total - remaining) / total) * 100 : 0

  const handleStop = () => {
    // Save interrupted session before resetting
    if (pomodoro.startedAt) {
      fetch('/api/pomodoro/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }

  return (
    <div className={cn(
      'shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-xl safe-area-bottom',
      !hasActivity && 'hidden'
    )}>
      <div className="flex items-center gap-3 px-3 lg:px-5 py-2.5 overflow-x-auto">

        {/* ── Pomodoro with inline controls ── */}
        {pomodoro.isRunning && (
          <div className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl border shrink-0 min-w-[220px]',
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

            {/* Inline controls — no navigation needed */}
            {pomodoro.isPaused ? (
              <button onClick={storeResume}
                className="shrink-0 w-7 h-7 rounded-full bg-success/20 text-success flex items-center justify-center hover:bg-success/30 active:scale-[0.95] transition-all"
                title="继续" aria-label="继续">
                <span className="text-xs">▶</span>
              </button>
            ) : (
              <button onClick={storePause}
                className="shrink-0 w-7 h-7 rounded-full bg-warning/20 text-warning flex items-center justify-center hover:bg-warning/30 active:scale-[0.95] transition-all"
                title="暂停" aria-label="暂停">
                <span className="text-xs">⏸</span>
              </button>
            )}
            <button onClick={handleStop}
              className="shrink-0 w-7 h-7 rounded-full bg-muted-foreground/15 text-muted-foreground flex items-center justify-center hover:bg-destructive/20 hover:text-destructive active:scale-[0.95] transition-all"
              title="停止" aria-label="停止">
              <span className="text-[10px]">⏹</span>
            </button>
          </div>
        )}

        {/* ── Practice ── */}
        {practice.activeSessionId && (
          <a href={`/practice?session=${practice.activeSessionId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/20 bg-brand-muted shrink-0 hover:shadow-sm active:scale-[0.98] transition-all">
            <span className="text-lg">✏️</span>
            <div>
              <p className="text-xs font-medium">{practice.activeSubject || '练习中'}</p>
              <p className="text-[10px] text-muted-foreground">第 {practice.currentIndex + 1} 题</p>
            </div>
          </a>
        )}

        {/* ── AI generating ── */}
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
    </div>
  )
}
