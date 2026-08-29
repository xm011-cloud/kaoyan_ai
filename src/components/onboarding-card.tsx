'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUIStore } from '@/stores/ui-store'
import { useAiConfigStatus } from '@/hooks/use-ai-config-status'

/**
 * 新用户引导卡（dashboard 顶部常驻）：设目标 → 探索功能 → 配置 AI（可选）。
 * 设好目标后自动收起（isNewUser 判定）；可手动关闭。
 * forceTour（?tour=1）：无条件显示，供测试与「重新查看引导」。
 */
export function OnboardingCard({ isNewUser, hasGoal, forceTour = false }: { isNewUser: boolean; hasGoal: boolean; forceTour?: boolean }) {
  const { configured: aiConfigured } = useAiConfigStatus()
  const [dismissed, setDismissed] = useState(false)

  // 设好目标 = 完成（AI 配置是可选项，不再参与完成判定）
  const allDone = hasGoal
  if ((!isNewUser && !forceTour) || dismissed || (!forceTour && allDone)) return null

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium text-foreground">🚀 新手上路 —— 完成下面几步，解锁完整备考体验</p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="关闭新手指引"
          className="inline-flex min-h-11 min-w-11 items-center justify-center -my-3 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-2.5">
        {/* ① 设置目标（核心，高亮） */}
        <StepLink
          href="/goal"
          done={hasGoal}
          icon="🎯"
          label="设置考研目标"
          desc="院校/专业/科目/考试日期"
          highlight={!hasGoal}
        />
        {/* ② 探索功能 */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-3 py-2">
          <span className="text-base">📚</span>
          <div className="leading-tight">
            <p className="text-xs font-medium text-foreground">探索功能</p>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <Link href="/checkin" className="hover:text-brand">打卡</Link>
              <Link href="/wrong-questions" className="hover:text-brand">错题</Link>
              <Link href="/admission" className="hover:text-brand">院校</Link>
              <Link href="/skills" className="hover:text-brand">技能</Link>
            </div>
          </div>
        </div>
        {/* ③ 配置 AI（可选，不高亮） */}
        <StepLink
          href="/settings"
          done={aiConfigured}
          icon="🤖"
          label="配置 AI Key"
          desc="可选 · 对话/计划/周报可用"
          highlight={false}
        />
      </div>
    </div>
  )
}

function StepLink({
  href,
  done,
  icon,
  label,
  desc,
  highlight,
}: {
  href: string
  done: boolean
  icon: string
  label: string
  desc: string
  highlight: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
        done
          ? 'border-success/30 bg-success/5'
          : highlight
            ? 'border-brand/40 bg-brand/10 hover:bg-brand/15'
            : 'border-border/50 bg-card hover:bg-muted/60'
      }`}
    >
      <span className="text-base">{done ? '✅' : icon}</span>
      <div className="leading-tight">
        <p className="text-xs font-medium text-foreground">{done ? `${label}（已完成）` : label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </Link>
  )
}
