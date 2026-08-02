'use client'

import Link from 'next/link'
import { useActivityStore } from '@/stores/activity-store'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { useEffect } from 'react'
import { formatTime } from '@/lib/time-utils'
import { cn } from '@/lib/utils'

/**
 * 底部活动栏 — OS 外壳第 3 层（始终可见）
 * 显示后台活动的完整控制面板：番茄钟进度条 + 练习状态
 * 与 TopBar 中的 compact chips 不同，这里是完整版
 */
export function ActivityBar() {
  const { activities, register, unregister, updateStatus, clearCompleted } = useActivityStore()
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()

  // ── Sync pomodoro ──
  useEffect(() => {
    if (pomodoro.isRunning) {
      register({
        id: 'pomodoro',
        type: 'pomodoro',
        title: `🍅 ${pomodoro.currentSubject || '专注中'}`,
        subtitle: `剩余 ${formatTime(pomodoro.remainingSeconds)}`,
        icon: '🍅',
        status: pomodoro.isPaused ? 'paused' : 'running',
        linkTo: '/pomodoro',
      })
    } else if (pomodoro.completedSessions > 0) {
      updateStatus('pomodoro', 'completed', `${pomodoro.completedSessions} 个番茄完成`)
      const t = setTimeout(() => unregister('pomodoro'), 3000)
      return () => clearTimeout(t)
    } else {
      unregister('pomodoro')
    }
  }, [pomodoro.isRunning, pomodoro.isPaused, pomodoro.remainingSeconds, pomodoro.currentSubject, pomodoro.completedSessions])

  // ── Sync practice ──
  useEffect(() => {
    if (practice.activeSessionId) {
      register({
        id: 'practice',
        type: 'practice',
        title: `✏️ ${practice.activeSubject || '练习中'}`,
        subtitle: `第 ${practice.currentIndex + 1} 题`,
        icon: '✏️',
        status: 'in_progress',
        linkTo: `/practice?session=${practice.activeSessionId}`,
      })
    } else if (practice.isGenerating) {
      register({
        id: 'practice-gen',
        type: 'ai_generation',
        title: '🤖 AI 出题中',
        subtitle: '正在生成题目...',
        icon: '🤖',
        status: 'running',
        linkTo: '/practice',
      })
    } else {
      unregister('practice')
      unregister('practice-gen')
    }
  }, [practice.activeSessionId, practice.activeSubject, practice.currentIndex, practice.isGenerating])

  // ── Auto-clean completed ──
  useEffect(() => {
    const completed = activities.filter((a) => a.status === 'completed')
    if (completed.length === 0) return
    const t = setTimeout(clearCompleted, 5000)
    return () => clearTimeout(t)
  }, [activities])

  const activeList = activities.filter((a) => a.status !== 'completed')

  // ── Build inline controls ──
  const pomoProgress = pomodoro.isRunning
    ? ((pomodoro.totalSeconds - pomodoro.remainingSeconds) / pomodoro.totalSeconds) * 100
    : 0

  return (
    <div className={cn(
      'shrink-0 border-t bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm',
      'safe-area-bottom',
      activeList.length > 0 ? 'block' : 'hidden'
    )}>
      <div className="flex items-center gap-3 px-3 lg:px-5 py-2.5 overflow-x-auto">
        {/* Pomodoro inline control */}
        {pomodoro.isRunning && (
          <div className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg border shrink-0 min-w-[200px]',
            pomodoro.isPaused
              ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20'
              : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
          )}>
            <span className="text-lg">🍅</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {pomodoro.sessionType === 'focus' ? '专注' : pomodoro.sessionType === 'short_break' ? '短休' : '长休'}
                  {pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}
                </span>
                <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">
                  {formatTime(pomodoro.remainingSeconds)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    pomodoro.isPaused ? 'bg-yellow-400' : 'bg-red-400'
                  )}
                  style={{ width: `${pomoProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Practice control */}
        {practice.activeSessionId && (
          <Link
            href={`/practice?session=${practice.activeSessionId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 shrink-0 hover:shadow-sm transition-shadow"
          >
            <span className="text-lg">✏️</span>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {practice.activeSubject || '练习中'}
              </p>
              <p className="text-[10px] text-gray-400">
                第 {practice.currentIndex + 1} 题 — 点击继续
              </p>
            </div>
          </Link>
        )}

        {/* AI generating indicator */}
        {practice.isGenerating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 shrink-0">
            <span className="text-lg animate-pulse">🤖</span>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">AI 出题中</p>
              <p className="text-[10px] text-gray-400">请稍候...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
