import Link from 'next/link'

interface ContinueLearningCardProps {
  lessons: Array<{
    id: string
    title: string
    status: string
    courseTitle: string
    unitTitle: string
    noteCount: number
  }>
}

/**
 * 课程不是孤立入口：工作台只呈现下一步可行动的课时，详情仍留在课程页处理。
 */
export function ContinueLearningCard({ lessons }: ContinueLearningCardProps) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brand">课程学习</p>
          <h2 className="mt-1 text-base font-semibold">继续你的学习现场</h2>
          <p className="mt-1 text-sm text-muted-foreground">课时、学习记录和下一步都在同一个上下文里。</p>
        </div>
        <Link href="/courses" className="shrink-0 text-sm font-medium text-brand hover:underline">全部课程 →</Link>
      </div>

      {lessons.length === 0 ? (
        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          还没有可继续的课时。把正在学的一门课接入这里，就能留下过程和卡点。
          <Link href="/courses" className="ml-2 font-medium text-brand hover:underline">添加课程</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href="/courses"
              className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <span className={`h-2 w-2 rounded-full ${lesson.status === 'in_progress' ? 'bg-warning' : 'bg-muted-foreground/30'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{lesson.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{lesson.courseTitle} · {lesson.unitTitle}{lesson.noteCount ? ` · ${lesson.noteCount} 条记录` : ''}</span>
              </span>
              <span className="text-xs font-medium text-brand">{lesson.status === 'in_progress' ? '继续' : '开始'} →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
