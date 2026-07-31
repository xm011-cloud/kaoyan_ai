'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CheckInPage() {
  const [duration, setDuration] = useState('')
  const [status, setStatus] = useState<'good' | 'normal' | 'tired'>('good')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [todayCheckIn, setTodayCheckIn] = useState<{
    duration: number
    status: string
    note?: string | null
  } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // 加载今日打卡记录
  useEffect(() => {
    const loadToday = async () => {
      try {
        const res = await fetch(`/api/checkin?date=${today}`)
        const data = await res.json()
        if (data.checkIn) {
          setTodayCheckIn(data.checkIn)
          setSubmitted(true)
        }
      } catch {
        // 忽略
      }
    }
    loadToday()
  }, [today])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          duration,
          status,
          note: note || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '打卡失败')

      setSubmitted(true)
      setTodayCheckIn(data.checkIn)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  if (submitted && todayCheckIn) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">今日已打卡！</h2>
          <div className="text-gray-500 space-y-1">
            <p>学习时长：{todayCheckIn.duration} 分钟</p>
            <p>
              状态：
              {todayCheckIn.status === 'good' && '😊 状态很好'}
              {todayCheckIn.status === 'normal' && '😐 状态一般'}
              {todayCheckIn.status === 'tired' && '😫 有点疲惫'}
            </p>
            {todayCheckIn.note && <p>备注：{todayCheckIn.note}</p>}
          </div>
          <Button onClick={() => {
            setSubmitted(false)
            setTodayCheckIn(null)
            setDuration('')
            setNote('')
          }}>
            {todayCheckIn ? '修改打卡' : '再次打卡'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">每日打卡</h1>
          <p className="text-gray-500 mt-1">记录今天的学习情况</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div>
            <label htmlFor="checkin-duration" className="block text-sm font-medium mb-1">学习时长（分钟）</label>
            <input
              id="checkin-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="例如：120"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">今日状态</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'good', label: '状态很好', emoji: '😊' },
                { value: 'normal', label: '状态一般', emoji: '😐' },
                { value: 'tired', label: '有点疲惫', emoji: '😫' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value as typeof status)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    status === item.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="text-2xl">{item.emoji}</div>
                  <div className="text-xs mt-1">{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="checkin-note" className="block text-sm font-medium mb-1">备注（可选）</label>
            <textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="今天学了什么？有什么收获？"
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '打卡中...' : '完成打卡'}
          </Button>
        </form>

        {/* 相关模块 */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-3">相关模块</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/pomodoro" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">🍅 番茄钟</Link>
            <Link href="/tasks" className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">📋 任务计划</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
