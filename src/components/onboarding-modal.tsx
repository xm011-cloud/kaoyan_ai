'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { useUIStore } from '@/stores/ui-store'

/**
 * 新用户首次引导弹窗：「第一件小事」三路选择（考研/还没想好/先逛逛）。
 * - 仅首次登录且为新用户时显示一次；关闭后不再弹出（onboardingSeen）。
 * - forceTour（?tour=1）：无条件显示，关闭不写已读——供测试与「重新查看引导」用。
 */
export function OnboardingModal({ isNewUser, forceTour = false }: { isNewUser: boolean; forceTour?: boolean }) {
  const onboardingSeen = useUIStore((s) => s.onboardingSeen)
  const setOnboardingSeen = useUIStore((s) => s.setOnboardingSeen)
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // 首帧不弹，稍作延迟让页面先渲染；forceTour 立即弹
    if (forceTour || (isNewUser && !onboardingSeen)) {
      const t = setTimeout(() => setOpen(true), forceTour ? 0 : 800)
      return () => clearTimeout(t)
    }
  }, [isNewUser, onboardingSeen, forceTour])

  if (!open) return null

  const dismiss = () => {
    setOpen(false)
    if (!forceTour) setOnboardingSeen(true)
  }

  const go = (path: string) => {
    setOpen(false)
    if (!forceTour) setOnboardingSeen(true)
    router.push(path)
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title="🎉 欢迎来到 AI 考研助手"
      description="你打算怎么准备？选一条路，我们从第一件小事开始。"
    >
      <div className="space-y-2.5">
        <PathButton icon="🎯" title="我是考研人" desc="设目标院校/专业/科目，生成专属备考计划" onClick={() => go('/goal')} />
        <PathButton icon="📝" title="还没想好 / 想学别的" desc="还没定方向？或描述你想学什么，生成自定义计划" onClick={() => go('/tasks')} />
        <PathButton icon="👀" title="先逛逛" desc="直接进工作台，慢慢探索" onClick={dismiss} />
      </div>

      <p className="text-xs text-muted-foreground mt-3.5">
        AI 功能需自配 Key（设置页配置），不配置不影响打卡 / 番茄钟 / 错题等功能
      </p>
    </Modal>
  )
}

function PathButton({
  icon, title, desc, onClick,
}: {
  icon: string
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left hover:border-brand/40 hover:bg-brand/5 transition-colors active:scale-[0.99]"
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
      </span>
    </button>
  )
}
