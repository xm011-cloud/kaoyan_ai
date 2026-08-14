import type { Metadata } from 'next'
import { CHANGELOG } from '@/lib/changelog'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: '更新日志 · AI 考研助手',
  description: 'AI 考研助手最近更新了什么',
}

export default function ChangelogPage() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="📣 更新日志" subtitle="每次发版都记在这里，欢迎反馈建议" />

      {CHANGELOG.map((entry) => (
        <div key={entry.id} className="rounded-2xl bg-card border border-border/50 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground shrink-0">{entry.date}</span>
            <h2 className="font-semibold text-foreground">{entry.title}</h2>
          </div>
          <ul className="space-y-1.5">
            {entry.items.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2 leading-relaxed">
                <span className="text-brand shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
