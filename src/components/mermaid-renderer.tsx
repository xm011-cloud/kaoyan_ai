'use client'

import { useEffect, useRef, useState } from 'react'

interface MermaidRendererProps {
  chart: string
}

/**
 * 动态加载 mermaid 并渲染图表
 * 使用动态 import 避免 SSR 报错
 */
export function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default

        // Initialize once
        if (!mermaid.initialize) {
          // Already initialized check
        }

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        })

        const { svg } = await mermaid.render(idRef.current, chart)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch {
        if (!cancelled) {
          setError(true)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [chart])

  if (error) {
    return (
      <div className="my-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <p className="text-xs text-red-500">图表渲染失败，以下是原始代码：</p>
        <pre className="mt-1 text-[11px] text-gray-500 overflow-x-auto">{chart}</pre>
      </div>
    )
  }

  return (
    <div className="my-3 flex justify-center overflow-x-auto">
      <div ref={containerRef} className="mermaid-container inline-block" />
    </div>
  )
}
