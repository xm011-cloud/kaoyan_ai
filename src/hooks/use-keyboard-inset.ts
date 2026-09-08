'use client'

import { useEffect, useState } from 'react'

/** 覆盖式软键盘占用的底部像素；resize-content 模式会自然返回 0。 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    const compute = () => {
      if (!window.matchMedia('(max-width: 1023px)').matches || !viewport) {
        setInset(0)
        return
      }
      setInset(Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height))
    }

    viewport?.addEventListener('resize', compute)
    viewport?.addEventListener('scroll', compute)
    window.addEventListener('resize', compute)
    compute()
    return () => {
      viewport?.removeEventListener('resize', compute)
      viewport?.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [])

  return inset
}
