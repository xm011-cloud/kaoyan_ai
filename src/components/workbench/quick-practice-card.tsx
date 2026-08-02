'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCreatePracticeSession } from '@/hooks/use-practice'
import { useUIStore } from '@/stores/ui-store'

interface QuickPracticeCardProps {
  subjects: string[]
  todaySubjects: string[] // from today's tasks/checkins
  dueWrongCount: number // wrong questions due for review
}

export function QuickPracticeCard({
  subjects,
  todaySubjects,
  dueWrongCount,
}: QuickPracticeCardProps) {
  const router = useRouter()
  const createSession = useCreatePracticeSession()
  const practiceDefaults = useUIStore((s) => s.practiceDefaults)

  const primarySubject = todaySubjects[0] || subjects[0] || ''

  const handleQuickStart = (mode: 'daily_review' | 'spaced_review' | 'mock_exam') => {
    const config = {
      daily_review: {
        subject: primarySubject,
        type: 'daily' as const,
      },
      spaced_review: {
        subject: primarySubject,
        type: 'daily' as const,
        wrongQuestionIds: [] as string[], // will be resolved to "auto" on server
      },
      mock_exam: {
        subject: primarySubject,
        type: 'mock' as const,
        duration: 180,
      },
    }[mode]

    createSession.mutate(
      {
        ...config,
        materialIds: undefined,
      },
      {
        onSuccess: (session) => {
          router.push(`/practice?session=${session.id}`)
        },
      }
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">快速练习</h3>
        <Link href="/practice" className="text-sm text-blue-500 hover:underline">
          更多模式 →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 今日巩固 */}
        <button
          onClick={() => handleQuickStart('daily_review')}
          disabled={!primarySubject || createSession.isPending}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-300 transition-colors text-left disabled:opacity-50"
        >
          <span className="text-2xl">🎯</span>
          <span className="text-sm font-medium">今日巩固</span>
          <span className="text-[11px] text-gray-500 text-center">
            {todaySubjects.length > 0
              ? `基于今日学习：${todaySubjects.slice(0, 2).join('、')}`
              : '基于今日学习内容'}
          </span>
        </button>

        {/* 间隔复习 */}
        <button
          onClick={() => handleQuickStart('spaced_review')}
          disabled={!primarySubject || createSession.isPending}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 hover:border-orange-300 transition-colors text-left disabled:opacity-50"
        >
          <span className="text-2xl">🔄</span>
          <span className="text-sm font-medium">间隔复习</span>
          <span className="text-[11px] text-gray-500 text-center">
            {dueWrongCount > 0
              ? `${dueWrongCount} 题到期需复习`
              : '暂无到期复习题'}
          </span>
        </button>

        {/* 模拟考试 */}
        <button
          onClick={() => handleQuickStart('mock_exam')}
          disabled={!primarySubject || createSession.isPending}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-900/10 hover:border-purple-300 transition-colors text-left disabled:opacity-50"
        >
          <span className="text-2xl">⏱️</span>
          <span className="text-sm font-medium">模拟考试</span>
          <span className="text-[11px] text-gray-500 text-center">
            {primarySubject ? `${primarySubject} · 180分钟` : '全真模拟'}
          </span>
        </button>
      </div>
    </div>
  )
}

