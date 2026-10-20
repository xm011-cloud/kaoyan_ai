'use client'

import { useState } from 'react'
import FeedbackList, { type FeedbackItem } from './feedback-list'
import SupportList, { type SupporterItem } from './support-list'
import AdmissionDisputes, { type DisputeItem } from './admission-disputes'
import DeletionRequests, { type DeletionRequestItem } from './deletion-requests'
import UserReset from './user-reset'
import FunnelView from './funnel-view'
import ClosureHealthView from './closure-health-view'
import DataSeed from './data-seed'

type Tab = 'funnel' | 'closure' | 'data-seed' | 'feedback' | 'support' | 'dispute' | 'deletion' | 'reset'

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
    { id: 'closure' as const, icon: '🔗', label: '闭环健康度' },
    { id: 'data-seed' as const, icon: '🏫', label: '数据补全' },
    { id: 'feedback' as const, icon: '💬', label: '反馈收件箱' },
    { id: 'support' as const, icon: '☕', label: '支持留言' },
    { id: 'dispute' as const, icon: '🏫', label: '院校质疑' },
    { id: 'deletion' as const, icon: '🗑️', label: '注销请求' },
    { id: 'reset' as const, icon: '🔑', label: '重置密码' },
  ]

  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 pb-2 sm:pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'funnel' && <FunnelView />}
      {tab === 'closure' && <ClosureHealthView />}
      {tab === 'data-seed' && <DataSeed />}
      {tab === 'feedback' && <FeedbackList initial={initialFeedbacks} />}
      {tab === 'support' && <SupportList initial={initialSupporters} />}
      {tab === 'dispute' && <AdmissionDisputes initial={initialDisputes} />}
      {tab === 'deletion' && <DeletionRequests initial={initialDeletions} />}
      {tab === 'reset' && <UserReset />}
    </>
  )
}
