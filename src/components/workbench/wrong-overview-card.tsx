'use client'

import Link from 'next/link'

interface WrongTrim { id: string; question: string; subject: string; interval: number; nextReviewDate: string | null }

export function WrongOverviewCard({ wrongQuestions, dueCount }: { wrongQuestions: WrongTrim[]; dueCount: number }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold">🔴 错题概览</h3>
        <Link href="/wrong-questions" className="text-xs text-brand font-medium hover:underline">错题本 →</Link>
      </div>
      <div className="p-2">
        {wrongQuestions.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl">🎯</span>
            <p className="text-sm text-muted-foreground mt-2">还没有错题，继续保持！</p>
          </div>
        ) : (
          <div>
            {dueCount > 0 && (
              <div className="flex items-center gap-2 mx-3 mt-2 mb-2 px-3 py-2 rounded-xl bg-warning/10 text-warning text-sm font-medium">
                <span>🔔</span>
                <span>{dueCount} 道错题等待复习</span>
              </div>
            )}
            <div className="divide-y divide-border/30">
              {wrongQuestions.slice(0, 3).map((wq) => (
                <div key={wq.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 rounded-xl transition-colors">
                  <span className="text-xs text-destructive shrink-0">●</span>
                  <span className="text-xs text-foreground/80 truncate flex-1">{wq.question.slice(0, 30)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{wq.subject} · {wq.interval}天</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
