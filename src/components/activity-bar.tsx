'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useActivityStore } from '@/stores/activity-store'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { formatTime } from '@/lib/time-utils'
import { cn } from '@/lib/utils'

/**
 * Bottom activity panel — Apple HIG style
 * Appears only when there are running activities
 * Minimal, compact, with progress indicator
 */
export function ActivityBar() {
  const { register, unregister, updateStatus, clearCompleted } = useActivityStore()
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()

  useEffect(() => {
    if (pomodoro.isRunning) {
      register({ id: 'pomodoro', type: 'pomodoro', title: `专注${pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}`, subtitle: formatTime(pomodoro.remainingSeconds), icon: '🍅', status: pomodoro.isPaused ? 'paused' : 'running', linkTo: '/pomodoro' })
    } else {
      unregister('pomodoro')
    }
  }, [pomodoro.isRunning, pomodoro.isPaused, pomodoro.remainingSeconds])

  useEffect(() => {
    if (practice.activeSessionId) {
      register({ id: 'practice', type: 'practice', title: `练习 · ${practice.activeSubject || ''}`, subtitle: `第 ${practice.currentIndex + 1} 题`, icon: '✏️', status: 'in_progress', linkTo: `/practice?session=${practice.activeSessionId}` })
    } else {
      unregister('practice')
    }
  }, [practice.activeSessionId, practice.activeSubject, practice.currentIndex])

  // Clean completed after delay
  useEffect(() => {
    const completed = pomodoro.completedSessions > 0 && !pomodoro.isRunning
    if (completed) {
      updateStatus('pomodoro', 'completed', `${pomodoro.completedSessions} 个番茄`)
      const t = setTimeout(() => { unregister('pomodoro'); clearCompleted() }, 4000)
      return () => clearTimeout(t)
    }
  }, [pomodoro.completedSessions])

  const pomoProgress = pomodoro.isRunning ? ((pomodoro.totalSeconds - pomodoro.remainingSeconds) / pomodoro.totalSeconds) * 100 : 0

  if (!pomodoro.isRunning && !practice.activeSessionId && !practice.isGenerating) return null

  return (
    <div className="shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto">

        {/* Pomodoro */}
        {pomodoro.isRunning && (
          <div className={cn('flex items-center gap-3 px-3 py-2 rounded-xl border shrink-0 min-w-[180px]',
            pomodoro.isPaused ? 'border-warning/40 bg-warning/5' : 'border-destructive/20 bg-destructive/5')}>
            <span className="text-lg">🍅</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">
                  {pomodoro.sessionType === 'focus' ? '专注' : pomodoro.sessionType === 'short_break' ? '短休' : '长休'}
                  {pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}
                </span>
                <span className="text-xs font-mono font-bold">{formatTime(pomodoro.remainingSeconds)}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-muted mt-1 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-1000', pomodoro.isPaused ? 'bg-warning' : 'bg-destructive')} style={{ width: `${pomoProgress}%` }} />
              </div>
            </div>
            {pomodoro.isPaused && <span className="text-xs text-warning font-medium">⏸</span>}
          </div>
        )}

        {/* Practice */}
        {practice.activeSessionId && (
          <Link href={`/practice?session=${practice.activeSessionId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/20 bg-brand/5 shrink-0 hover:shadow-sm active:scale-[0.98] transition-all">
            <span className="text-lg">✏️</span>
            <div>
              <p className="text-xs font-medium">{practice.activeSubject || '练习中'}</p>
              <p className="text-[10px] text-muted-foreground">第 {practice.currentIndex + 1} 题</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
