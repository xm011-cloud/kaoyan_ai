'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Feedback {
  id: string
  weekStart: string
  weekEnd: string
  content: string
  suggestions: string[]
  createdAt: string
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const loadFeedbacks = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      setFeedbacks(data.feedbacks || [])
    } catch {
      // 加载失败
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeedbacks()
  }, [loadFeedbacks])

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/ai/generate-feedback', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')

      if (data.regenerated === false) {
        setGenError('本周反馈已存在，无需重复生成')
      } else {
        setFeedbacks(prev => [data.feedback, ...prev])
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('zh-CN')
    const e = new Date(end).toLocaleDateString('zh-CN')
    return `${s} - ${e}`
  }

  // 本周范围
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">学习周报</h1>
            <p className="text-gray-500 mt-1">AI 基于你的学习数据生成周报和建议</p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? 'AI 分析中...' : '生成本周反馈'}
          </Button>
        </div>

        {genError && (
          <p className={`text-sm px-4 py-2 rounded ${genError.includes('已存在') ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-red-50 text-red-500 dark:bg-red-900/30'}`}>
            {genError}
          </p>
        )}

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-xl border">
              <div className="text-4xl mb-3">📊</div>
              <p className="font-medium">暂无学习反馈</p>
              <p className="text-sm mt-1">
                完成一周的学习后，点击上方按钮让 AI 为你生成专属反馈
              </p>
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div key={feedback.id} className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
                {/* 头部 */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">
                      📅 {formatWeek(feedback.weekStart, feedback.weekEnd)}
                    </h2>
                    <span className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      生成于 {new Date(feedback.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>

                {/* 内容 */}
                <div className="px-6 py-4 space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.content}</p>
                  </div>

                  {feedback.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm flex items-center gap-1">
                        <span>🤖</span> AI 建议
                      </h3>
                      <ul className="space-y-2">
                        {feedback.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-500 mt-0.5 shrink-0">▸</span>
                            <span className="text-gray-600 dark:text-gray-400">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 相关模块 */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-3">相关模块</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">📋 任务计划</Link>
            <Link href="/study-path" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🗺️ 学习路径</Link>
            <Link href="/practice" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">✏️ 练习</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
