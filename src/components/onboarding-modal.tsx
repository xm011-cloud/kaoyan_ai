'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { useUIStore } from '@/stores/ui-store'

/**
 * 新用户首次引导弹窗：功能导览 + AI 使用说明（重点）。
 * 仅首次登录且为新用户时显示一次；关闭后不再弹出（onboardingSeen）。
 */
export function OnboardingModal({ isNewUser }: { isNewUser: boolean }) {
  const onboardingSeen = useUIStore((s) => s.onboardingSeen)
  const setOnboardingSeen = useUIStore((s) => s.setOnboardingSeen)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // 首帧不弹，稍作延迟让页面先渲染
    if (isNewUser && !onboardingSeen) {
      const t = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(t)
    }
  }, [isNewUser, onboardingSeen])

  if (!open) return null

  const dismiss = () => {
    setOpen(false)
    setOnboardingSeen(true)
  }

  const groups = [
    { icon: '📅', name: '今日', items: [['🏠', '概览'], ['✅', '打卡'], ['🍅', '番茄钟'], ['🏆', '学习圈']] },
    { icon: '📝', name: '备考', items: [['🎯', '目标'], ['📋', '计划'], ['✏️', '练习'], ['📕', '错题']] },
    { icon: '🤖', name: 'AI', items: [['💬', '对话'], ['📊', '周报'], ['🗺️', '路径'], ['⚡', '技能']] },
    { icon: '📚', name: '知识', items: [['📖', '资料'], ['🧠', '图谱'], ['🏫', '院校'], ['👤', '资料']] },
  ]

  return (
    <Modal
      open
      onClose={dismiss}
      title="🎉 欢迎来到 AI 考研助手"
      description="这是你的备考工作台 —— 4 大分组 19 个功能，先花 1 分钟认识它"
      footer={
        <>
          <Link href="/settings" onClick={dismiss}>
            <span className="inline-flex items-center justify-center rounded-full h-11 px-6 text-sm font-semibold bg-brand hover:bg-brand/90 text-brand-foreground active:scale-[0.98] transition-all">
              🤖 去配置 AI
            </span>
          </Link>
          <button
            onClick={dismiss}
            className="rounded-full h-11 px-6 text-sm font-medium border border-border/60 hover:bg-muted transition-colors"
          >
            先逛逛
          </button>
        </>
      }
    >
      {/* 功能导览 */}
      <div className="grid grid-cols-2 gap-2.5">
        {groups.map((g) => (
          <div key={g.name} className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="text-xs font-semibold mb-1.5">
              {g.icon} {g.name}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {g.items.map(([icon, label]) => (
                <span key={`${g.name}-${label}`} className="text-[11px] text-muted-foreground">
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AI 使用说明（重点） */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 mt-3">
        <p className="text-sm font-semibold text-foreground">🤖 AI 功能如何使用（重要）</p>
        <ul className="text-xs text-muted-foreground mt-1.5 space-y-1">
          <li>· AI 需要你自己的 API Key（支持 MiMo / DeepSeek / 通义千问等，OpenAI 兼容）</li>
          <li>· 在「设置 → AI 配置」填 Key 并点「测试连接」，配置一次即可用于对话 / 计划 / 周报 / 技能</li>
          <li>· <b>不配置不影响</b>打卡、番茄钟、错题本等非 AI 功能</li>
        </ul>
      </div>
    </Modal>
  )
}
