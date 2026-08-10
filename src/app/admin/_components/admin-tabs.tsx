'use client'

import { useState } from 'react'
import FeedbackList, { type FeedbackItem } from './feedback-list'
import SupportList, { type SupporterItem } from './support-list'
import UserReset from './user-reset'

type Tab = 'feedback' | 'support' | 'reset'

export default function AdminTabs({
  initialFeedbacks,
  initialSupporters,
}: {
  initialFeedbacks: FeedbackItem[]
  initialSupporters: SupporterItem[]
}) {
  const [tab, setTab] = useState<Tab>('feedback')
  const tabs = [
    { id: 'feedback' as const, icon: '💬', label: '意见反馈' },
    { id: 'support' as const, icon: '☕', label: '支持留言' },
    { id: 'reset' as const, icon: '🔑', label: '重置密码' },
  ]

  return (
    <>
      <div className="flex gap-1 p-1 rounded-2xl bg-muted">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'feedback' && <FeedbackList initial={initialFeedbacks} />}
      {tab === 'support' && <SupportList initial={initialSupporters} />}
      {tab === 'reset' && <UserReset />}
    </>
  )
}
