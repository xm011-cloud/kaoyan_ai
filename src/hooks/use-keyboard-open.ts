'use client'

import { useEffect, useState } from 'react'

/**
 * 检测移动端软键盘是否弹出（visualViewport 缩小到明显小于布局视口）。
 * 用途：键盘弹出时隐藏底部导航栏等"不该跟着抬"的固定 UI。
 * 与聊天页的键盘 padding 互补：前者处理布局缩放后的遮挡，这里处理固定元素的显隐。
 */
export function useKeyboardOpen(threshold = 80): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const check = () => {
      const pad = (window.innerHeight || 0) - vv.height
      setOpen(pad > threshold)
    }
    vv.addEventListener('resize', check)
    window.addEventListener('resize', check)
    check()
    return () => {
      vv.removeEventListener('resize', check)
      window.removeEventListener('resize', check)
    }
  }, [threshold])

  return open
}
