'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AiConfigStatus {
  /** AI 当前是否可用（用户自配 key，或部署方配置了全局 key） */
  configured: boolean
  /** 是否用户自配 key（区别于全局 key） */
  hasKey: boolean
  /** 已配置 key 的掩码（sk-xxx…xxxx） */
  keyHint: string
  loading: boolean
  refresh: () => void
  /** 后端返回 needConfig 时强制标记为未配置（如 key 失效） */
  markUnconfigured: () => void
}

/**
 * 查询 AI 配置状态（GET /api/user/settings）。
 * 默认 configured=true 避免首帧闪现"未配置"引导条，加载完成后校正。
 */
export function useAiConfigStatus(): AiConfigStatus {
  const [state, setState] = useState({
    configured: true,
    hasKey: false,
    keyHint: '',
    loading: true,
  })

  const refresh = useCallback(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((d) =>
        setState({
          configured: !!d.aiConfigured,
          hasKey: !!d.hasKey,
          keyHint: d.keyHint || '',
          loading: false,
        })
      )
      .catch(() => setState((s) => ({ ...s, loading: false })))
  }, [])

  const markUnconfigured = useCallback(() => {
    setState((s) => ({ ...s, configured: false, loading: false }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, refresh, markUnconfigured }
}
