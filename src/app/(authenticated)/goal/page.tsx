'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface PlanSummary {
  totalTasks: number
  daysRemaining: number
  phases: Record<string, number>
  generatedBy: string
}

export default function GoalPage() {
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [examDate, setExamDate] = useState('')
  const [subjects, setSubjects] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)
  const router = useRouter()

  // 加载已有目标
  const loadGoal = useCallback(async () => {
    try {
      const res = await fetch('/api/goal')
      const data = await res.json()
      if (data.goal) {
        setUniversity(data.goal.university)
        setMajor(data.goal.major)
        setExamDate(data.goal.examDate.split('T')[0])
        setSubjects(data.goal.subjects.join('\n'))
        setSaved(true)
      }
    } catch {
      // 未设置目标，正常
    }
  }, [])

  useEffect(() => {
    loadGoal()
  }, [loadGoal])

  const generatePlan = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-plan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setPlanSummary(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI 计划生成失败，请稍后再试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          major,
          examDate,
          subjects: subjects.split('\n').filter(Boolean),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')

      setSaved(true)
      setLoading(false)

      // 保存成功后自动生成计划
      await generatePlan()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('重新生成将删除现有计划并创建新计划，确定继续？')) return
    await generatePlan()
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">设置考研目标</h1>
          <p className="text-gray-500 mt-1">填写你的目标信息，AI 将为你生成专属学习计划</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div>
            <label className="block text-sm font-medium mb-1">目标院校</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="例如：北京大学"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">目标专业</label>
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">考试日期</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">考试科目</label>
            <textarea
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
              placeholder="每行一个科目，例如：&#10;政治&#10;英语一&#10;数学一&#10;专业课"
              rows={4}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {saved && !error && !planSummary && <p className="text-sm text-green-600">目标已保存！</p>}

          <Button type="submit" className="w-full" disabled={loading || generating}>
            {generating ? 'AI 正在生成学习计划...' : loading ? '保存中...' : saved ? '更新目标并重新生成' : '保存目标并生成计划'}
          </Button>
        </form>

        {/* 计划生成结果 */}
        {planSummary && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl">📋</div>
              <div>
                <h3 className="text-lg font-bold text-green-600">学习计划已生成！</h3>
                <p className="text-sm text-gray-500">
                  {planSummary.generatedBy === 'ai' ? '🤖 AI 智能生成' : '📐 系统自动生成'}
                  （配置 OpenAI Key 可获得 AI 智能规划）
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{planSummary.totalTasks}</div>
                <div className="text-xs text-gray-500">总任务数</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{planSummary.daysRemaining}</div>
                <div className="text-xs text-gray-500">剩余天数</div>
              </div>
              {Object.entries(planSummary.phases).map(([phase, count]) => (
                <div key={phase} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{count}</div>
                  <div className="text-xs text-gray-500">{phase}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => router.push('/tasks')} className="flex-1">
                查看学习计划
              </Button>
              <Button variant="outline" onClick={handleRegenerate} disabled={generating}>
                {generating ? '生成中...' : '重新生成'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
