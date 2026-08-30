'use client'

import { useState } from 'react'
import FeedbackList, { type FeedbackItem } from './feedback-list'
import SupportList, { type SupporterItem } from './support-list'
import AdmissionDisputes, { type DisputeItem } from './admission-disputes'
import DeletionRequests, { type DeletionRequestItem } from './deletion-requests'
import UserReset from './user-reset'
import FunnelView from './funnel-view'
import DataSeed from './data-seed'

type Tab = 'funnel' | 'data-seed' | 'feedback' | 'support' | 'dispute' | 'deletion' | 'reset'

export default function AdminTabs({
  initialFeedbacks,
  initialSupporters,
  initialDisputes,
  initialDeletions,
}: {
  initialFeedbacks: FeedbackItem[]
  initialSupporters: SupporterItem[]
  initialDisputes: DisputeItem[]
  initialDeletions: DeletionRequestItem[]
}) {
  const [tab, setTab] = useState<Tab>('funnel')
  const tabs = [
    { id: 'funnel' as const, icon: '📊', label: '激活漏斗' },
    { id: 'data-seed' as const, icon: '🏫', label: '数据补全' },
    { id: 'feedback' as const, icon: '💬', label: '意见反馈' },
    { id: 'support' as const, icon: '☕', label: '支持留言' },
    { id: 'dispute' as const, icon: '🏫', label: '院校质疑' },
    { id: 'deletion' as const, icon: '🗑️', label: '注销请求' },
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

      {tab === 'funnel' && <FunnelView />}
      {tab === 'data-seed' && <DataSeed />}
      {tab === 'feedback' && <FeedbackList initial={initialFeedbacks} />}
      {tab === 'support' && <SupportList initial={initialSupporters} />}
      {tab === 'dispute' && <AdmissionDisputes initial={initialDisputes} />}
      {tab === 'deletion' && <DeletionRequests initial={initialDeletions} />}
      {tab === 'reset' && <UserReset />}
    </>
  )
}
