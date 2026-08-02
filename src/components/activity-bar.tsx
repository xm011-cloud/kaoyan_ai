'use client'

import { useActivityStore } from '@/stores/activity-store'
import { usePomodoroStore } from '@/stores/pomodoro-store'
import { usePracticeStore } from '@/stores/practice-store'
import { useRouter } from 'next/navigation'
import { useEffect, useCallback } from 'react'
import { formatTime } from '@/lib/time-utils'

/**
 * 常驻底部活动栏
 * 显示所有"进行中"的后台活动（番茄钟 / 练习 / AI生成）
 * 在 layout 层挂载，不随页面切换消失
 */

export function ActivityBar() {
  const { activities, register, unregister, updateStatus, clearCompleted } = useActivityStore()
  const pomodoro = usePomodoroStore()
  const practice = usePracticeStore()
  const router = useRouter()

  // ── Sync pomodoro state → activity bar ──
  useEffect(() => {
    if (pomodoro.isRunning) {
      const status = pomodoro.isPaused ? 'paused' : 'running'
      const typeLabel = pomodoro.sessionType === 'focus' ? '专注' : pomodoro.sessionType === 'short_break' ? '短休' : '长休'
      register({
        id: 'pomodoro',
        type: 'pomodoro',
        title: `🍅 ${typeLabel}${pomodoro.currentSubject ? ` · ${pomodoro.currentSubject}` : ''}`,
        subtitle: `剩余 ${formatTime(pomodoro.remainingSeconds)}`,
        icon: '🍅',
        status,
        linkTo: '/pomodoro',
      })
    } else if (pomodoro.completedSessions > 0 && !pomodoro.isRunning) {
      // Show recently completed briefly
      updateStatus('pomodoro', 'completed', `${pomodoro.completedSessions} 个番茄完成`)
      const timer = setTimeout(() => unregister('pomodoro'), 3000)
      return () => clearTimeout(timer)
    } else {
      unregister('pomodoro')
    }
  }, [
    pomodoro.isRunning,
    pomodoro.isPaused,
    pomodoro.remainingSeconds,
    pomodoro.sessionType,
    pomodoro.currentSubject,
    pomodoro.completedSessions,
    register,
    unregister,
    updateStatus,
  ])

  // ── Sync practice state → activity bar ──
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
      const modeLabel =
        practice.generationMode === 'daily_review'
          ? '今日巩固'
          : practice.generationMode === 'spaced_review'
          ? '间隔复习'
          : practice.generationMode === 'mock_exam'
          ? '模拟考试'
          : '出题中'
      register({
        id: 'practice-gen',
        type: 'ai_generation',
        title: `🤖 AI ${modeLabel}`,
        subtitle: '正在生成题目...',
        icon: '🤖',
        status: 'running',
        linkTo: '/practice',
      })
    } else {
      unregister('practice')
      unregister('practice-gen')
    }
  }, [
    practice.activeSessionId,
    practice.activeSubject,
    practice.currentIndex,
    practice.isGenerating,
    practice.generationMode,
    register,
    unregister,
  ])

  // ── Navigate to activity ──
  const handleClick = useCallback(
    (activity: (typeof activities)[0]) => {
      if (activity.linkTo) {
        router.push(activity.linkTo)
      }
    },
    [router]
  )

  // ── Auto-clean completed after delay ──
  useEffect(() => {
    const completed = activities.filter((a) => a.status === 'completed')
    if (completed.length === 0) return
    const timer = setTimeout(clearCompleted, 5000)
    return () => clearTimeout(timer)
  }, [activities, clearCompleted])

  // ── No activities = nothing to show ──
  const activeList = activities.filter((a) => a.status !== 'completed')
  if (activeList.length === 0) return null

  return (
    <div className="shrink-0 border-t bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm safe-area-bottom">
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
        {activeList.map((activity) => (
          <button
            key={activity.id}
            onClick={() => handleClick(activity)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:shadow-sm transition-all shrink-0 text-left max-w-[240px]"
          >
            <span className="text-sm shrink-0">{activity.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {activity.title}
              </p>
              {activity.subtitle && (
                <p className="text-[10px] text-gray-400 truncate">{activity.subtitle}</p>
              )}
            </div>
            {activity.status === 'running' && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            )}
            {activity.status === 'paused' && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
