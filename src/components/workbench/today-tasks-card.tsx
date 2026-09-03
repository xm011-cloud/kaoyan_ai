'use client'

import Link from 'next/link'

interface TodayTask {
  id: string
  title: string
  completed: boolean
  duration?: number | null
  phase?: string | null
}

export function TodayTasksCard({ tasks, dateStr }: { tasks: TodayTask[]; dateStr: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <Link href="/tasks" className="text-sm font-semibold hover:text-brand">📋 今日任务</Link>
        <span className="text-[11px] text-muted-foreground">{dateStr}</span>
      </div>

      <div className="p-2">
        {tasks.length === 0 ? (
          <div className="text-center py-10">
            <span className="text-3xl">📝</span>
            <p className="text-sm text-muted-foreground mt-2">今天还没有任务</p>
            <Link href="/tasks" className="inline-flex min-h-11 items-center mt-2 text-xs text-brand font-medium hover:underline">
              去添加 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {tasks.slice(0, 6).map((task) => (
              <Link key={task.id} href="/tasks" className="flex items-center gap-3 px-3 py-2.5 group hover:bg-muted/50 rounded-xl transition-colors">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-success border-success' : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'}`}>
                  {task.completed && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className={`text-sm flex-1 truncate ${task.completed ? 'line-through text-muted-foreground/50' : ''}`}>
                  {task.title}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {task.duration ? `${task.duration}min` : ''}
                  {task.phase ? ` · ${task.phase}` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      {tasks.length > 5 && (
        <div className="px-5 py-2 border-t border-border/50">
          <Link href="/tasks" className="inline-flex min-h-11 items-center -my-3 text-xs text-brand font-medium hover:underline">
            查看全部 {tasks.length} 个任务 →
          </Link>
        </div>
      )}
    </div>
  )
}
