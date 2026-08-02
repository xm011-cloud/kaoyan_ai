'use client'

import Link from 'next/link'

interface TodayTask {
  id: string
  title: string
  completed: boolean
  duration?: number | null
  phase?: string | null
}

export function TodayTasksCard({
  tasks,
  dateStr,
}: {
  tasks: TodayTask[]
  dateStr: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">今日任务 ({dateStr})</h3>
        <Link href="/tasks" className="text-sm text-blue-500 hover:underline">
          查看全部 →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">今天还没有任务，去添加一个吧</p>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                task.completed ? 'bg-gray-50 dark:bg-gray-700/50 opacity-60' : ''
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  task.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {task.completed && <span className="text-white text-xs">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : ''}`}>
                  {task.title}
                </p>
                {task.duration && (
                  <p className="text-xs text-gray-400">{task.duration} 分钟</p>
                )}
              </div>
              {task.phase && (
                <span className="text-xs text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                  {task.phase}
                </span>
              )}
            </div>
          ))}
          {tasks.length > 5 && (
            <p className="text-xs text-gray-400 text-center">
              还有 {tasks.length - 5} 个任务...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
