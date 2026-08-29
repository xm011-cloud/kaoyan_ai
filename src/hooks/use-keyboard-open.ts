'use client'

import { useEffect, useRef, useState } from 'react'

/** 当前聚焦的元素是否为可输入的文本控件（软键盘会弹） */
function isTextInputActive(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['button', 'checkbox', 'radio', 'range', 'hidden', 'submit'].includes(type)
  }
  return false
}

/**
 * 检测移动端软键盘是否弹出（隐藏底部导航等"不该跟着抬"的固定 UI）。
 *
 * 三路信号取并集，覆盖各环境：
 *  - 基线对比（resize 模式：布局随键盘缩小，innerHeight 与 vv 一起缩，差值失效）
 *  - overlay 差值（iOS 覆盖式：innerHeight 不变）
 *  - 聚焦信号（PWA 独立模式 visualViewport 事件不触发时的兜底）
 */
export function useKeyboardOpen(threshold = 80): boolean {
  const [open, setOpen] = useState(false)
  const baselineRef = useRef<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (vv && baselineRef.current === null) baselineRef.current = vv.height

    const compute = () => {
      const focusSignal = isTextInputActive()
      let vvSignal = false
      if (vv) {
        const vh = vv.height
        baselineRef.current = Math.max(baselineRef.current ?? vh, vh)
        const drop = (baselineRef.current - vh) > threshold
        const overlay = (window.innerHeight || 0) - vh > threshold
        vvSignal = drop || overlay
      }
      setOpen(focusSignal || vvSignal)
    }

    vv?.addEventListener('resize', compute)
    window.addEventListener('resize', compute)
    document.addEventListener('focusin', compute)
    document.addEventListener('focusout', compute)
    compute()
    return () => {
      vv?.removeEventListener('resize', compute)
      window.removeEventListener('resize', compute)
      document.removeEventListener('focusin', compute)
      document.removeEventListener('focusout', compute)
    }
  }, [threshold])

  return open
}
