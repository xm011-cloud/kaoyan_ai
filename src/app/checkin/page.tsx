'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function CheckInPage() {
  const [duration, setDuration] = useState('')
  const [status, setStatus] = useState<'good' | 'normal' | 'tired'>('good')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 保存打卡记录
    console.log({ duration, status, note })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">打卡成功！</h2>
          <p className="text-gray-500">今天也辛苦了，继续加油！</p>
          <Button onClick={() => setSubmitted(false)}>再次打卡</Button>
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
            <label className="block text-sm font-medium mb-1">学习时长（分钟）</label>
            <input
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
            <label className="block text-sm font-medium mb-1">备注（可选）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="今天学了什么？有什么收获？"
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <Button type="submit" className="w-full">
            完成打卡
          </Button>
        </form>
      </div>
    </div>
  )
}
