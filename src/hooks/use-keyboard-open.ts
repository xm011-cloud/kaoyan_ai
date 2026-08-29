'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 检测移动端软键盘是否弹出。
 *
 * 为什么不用简单的 `innerHeight - vv.height`：
 *  - iOS/覆盖式键盘：innerHeight 不变、vv.height 缩小 → 差值有效
 *  - Android/resizes-content：布局视口随键盘缩小，innerHeight 和 vv.height 一起缩 → 差值≈0 失效
 * 所以用"基线对比"：记录无键盘时的最大可视高度（baseline），
 * 键盘弹出时 vv.height 明显低于基线即判定开启（resize 和 overlay 两种模式都适用）。
 */
export function useKeyboardOpen(threshold = 80): boolean {
  const [open, setOpen] = useState(false)
  const baselineRef = useRef<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    if (baselineRef.current === null) baselineRef.current = vv.height

    const check = () => {
      const vh = vv.height
      // 基线取历史最大值（无键盘、地址栏收起时可视高度最大）
      baselineRef.current = Math.max(baselineRef.current ?? vh, vh)
      const dropFromBaseline = (baselineRef.current - vh) > threshold
      const overlayDiff = (window.innerHeight || 0) - vh > threshold
      setOpen(dropFromBaseline || overlayDiff)
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
