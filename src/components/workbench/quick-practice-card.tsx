'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCreatePracticeSession } from '@/hooks/use-practice'

interface QuickPracticeCardProps {
  subjects: string[]
  todaySubjects: string[]
  dueWrongCount: number
}

const modes = [
  { mode: 'daily_review' as const, icon: '🎯', title: '今日巩固', desc: '基于今天学习内容', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
  { mode: 'spaced_review' as const, icon: '🔄', title: '间隔复习', desc: '遗忘曲线复习', color: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
  { mode: 'mock_exam' as const, icon: '⏱️', title: '模拟考试', desc: '限时全真模考', color: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' },
]

export function QuickPracticeCard({ subjects, todaySubjects, dueWrongCount }: QuickPracticeCardProps) {
  const router = useRouter()
  const createSession = useCreatePracticeSession()
  const primarySubject = todaySubjects[0] || subjects[0] || ''

  const handleQuickStart = (mode: string) => {
    const config = {
      daily_review: { subject: primarySubject, type: 'daily' as const },
      spaced_review: { subject: primarySubject, type: 'daily' as const, wrongQuestionIds: [] as string[] },
      mock_exam: { subject: primarySubject, type: 'mock' as const, duration: 180 },
    }[mode]

    if (!config) return
    createSession.mutate(
      { ...config, materialIds: undefined },
      { onSuccess: (s) => router.push(`/practice?session=${s.id}`) }
    )
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold">✏️ 快速练习</h3>
        <Link href="/practice" className="text-xs text-brand font-medium hover:underline">更多模式 →</Link>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => handleQuickStart(m.mode)}
            disabled={!primarySubject || createSession.isPending}
            className={`flex flex-col items-center text-center gap-2 p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${m.color}`}
          >
            <span className="text-2xl">{m.icon}</span>
            <span className="text-sm font-semibold">{m.title}</span>
            <span className="text-[11px] opacity-70">
              {m.mode === 'daily_review' && todaySubjects.length > 0
                ? todaySubjects.slice(0, 2).join(' · ')
                : m.mode === 'spaced_review'
                ? dueWrongCount > 0 ? `${dueWrongCount} 题到期` : '暂无到期'
                : m.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
