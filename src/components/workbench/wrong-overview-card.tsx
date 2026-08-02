'use client'

import Link from 'next/link'

interface WrongTrim {
  id: string
  question: string
  subject: string
  interval: number
  nextReviewDate: string | null
}

export function WrongOverviewCard({
  wrongQuestions,
  dueCount,
}: {
  wrongQuestions: WrongTrim[]
  dueCount: number
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">错题概览</h3>
        <Link href="/wrong-questions" className="text-sm text-blue-500 hover:underline">
          错题本 →
        </Link>
      </div>
      {wrongQuestions.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">还没有错题，继续保持！</p>
      ) : (
        <div className="space-y-2">
          {/* Due count badge */}
          {dueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm">
              <span>🔔</span>
              <span>{dueCount} 道错题等待复习</span>
            </div>
          )}

          {wrongQuestions.slice(0, 3).map((wq) => (
            <div key={wq.id} className="flex items-center gap-2 py-1.5">
              <span className="text-xs shrink-0">🔴</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                {wq.question.slice(0, 40)}
              </span>
              <span className="text-[10px] text-gray-400 shrink-0">
                {wq.subject} · 间隔 {wq.interval} 天
              </span>
            </div>
          ))}

          {wrongQuestions.length > 3 && (
            <p className="text-xs text-gray-400 text-center">
              共 {wrongQuestions.length} 道错题
            </p>
          )}
        </div>
      )}
    </div>
  )
}
