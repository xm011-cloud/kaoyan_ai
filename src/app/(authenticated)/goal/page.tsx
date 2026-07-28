'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubjectSelector } from './_components/subject-selector'
import { isCustomSubject, formatCustomSubjectLabel } from '@/lib/subject-standards'

function displaySubject(subj: string): string {
  return isCustomSubject(subj) ? formatCustomSubjectLabel(subj) : subj
}

interface PlanTask {
  id?: string
  title: string
  description?: string
  date: string
  duration?: number
  phase?: string
  subject: string
}

interface PlanSummary {
  totalTasks: number
  daysRemaining: number
  phases: Record<string, number>
  generatedBy: string
  tasks: PlanTask[]
}

interface JudgeResult {
  score: number
  strengths: string[]
  issues: { severity: string; description: string; fix: string }[]
  verdict: string
  summary: string
}

export default function GoalPage() {
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [examDate, setExamDate] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [targetScores, setTargetScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)
  const [judging, setJudging] = useState(false)
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null)
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
        setSubjects(Array.isArray(data.goal.subjects) ? data.goal.subjects : [])
        if (data.goal.targetScores && typeof data.goal.targetScores === 'object') {
          setTargetScores(data.goal.targetScores as Record<string, number>)
        }
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
      setJudgeResult(null)
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
      const subjectList = subjects.filter(Boolean)
      const res = await fetch('/api/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          major,
          examDate,
          subjects: subjectList,
          targetScores: Object.keys(targetScores).length > 0 ? targetScores : undefined,
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
    if (!confirm('重新生成将删除本周未完成任务并创建新计划，确定继续？')) return
    setJudgeResult(null)
    await generatePlan()
  }

  const handleJudge = async () => {
    if (!planSummary || planSummary.tasks.length === 0) return
    setJudging(true)
    setJudgeResult(null)
    try {
      const res = await fetch('/api/ai/judge-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: planSummary.tasks,
          examDate,
          subjects: subjects.filter(Boolean),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setJudgeResult(data as JudgeResult)
      } else {
        setError(data.error || '评审失败')
      }
    } catch {
      setError('评审失败，请稍后再试')
    } finally {
      setJudging(false)
    }
  }

  // Subject list from current value
  const subjectList = subjects

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
            <label className="block text-sm font-medium mb-2">考试科目</label>
            <SubjectSelector selected={subjects} onChange={setSubjects} />
          </div>

          {/* Target scores */}
          {subjectList.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                🎯 各科目标分数（可选，用于差距分析和 AI 择校对比）
              </label>
              <div className="grid grid-cols-2 gap-3">
                {subjectList.map((subj) => (
                  <div key={subj} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-20 shrink-0 truncate" title={subj}>
                      {displaySubject(subj)}
                    </span>
                    <input
                      type="number"
                      value={targetScores[subj] || ''}
                      onChange={(e) =>
                        setTargetScores((prev) => ({
                          ...prev,
                          [subj]: parseInt(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      max={150}
                      placeholder="分数"
                      className="flex-1 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-xs text-gray-400">分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <Button variant="outline" onClick={handleJudge} disabled={judging || generating}>
                {judging ? '评审中...' : '🔍 评审计划'}
              </Button>
              <Button variant="outline" onClick={handleRegenerate} disabled={generating || judging}>
                {generating ? '生成中...' : '重新生成'}
              </Button>
            </div>

            {/* 评审结果 */}
            {judgeResult && (
              <div className="mt-4 border-t pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`text-4xl ${
                    judgeResult.verdict === 'good' ? '' :
                    judgeResult.verdict === 'needs_work' ? 'opacity-70' : 'opacity-50'
                  }`}>
                    {judgeResult.verdict === 'good' ? '✅' : judgeResult.verdict === 'needs_work' ? '⚠️' : '❌'}
                  </div>
                  <div>
                    <h4 className="font-bold">
                      评审得分：<span className={`text-lg ${
                        judgeResult.score >= 80 ? 'text-green-600' :
                        judgeResult.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{judgeResult.score} 分</span>
                    </h4>
                    <p className="text-sm text-gray-500">{judgeResult.summary}</p>
                  </div>
                </div>

                {judgeResult.strengths.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-600 mb-1">👍 优点</h5>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                      {judgeResult.strengths.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {judgeResult.issues.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-red-500 mb-1">🔧 可改进 ({judgeResult.issues.length})</h5>
                    <div className="space-y-2">
                      {judgeResult.issues.map((issue, i) => (
                        <div key={i} className={`text-sm p-2 rounded ${
                          issue.severity === 'high'
                            ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-400'
                            : issue.severity === 'medium'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400'
                            : 'bg-gray-50 dark:bg-gray-900/20 border-l-2 border-gray-300'
                        }`}>
                          <span className="text-xs font-medium text-gray-400 uppercase">{issue.severity}</span>
                          <p className="mt-0.5">{issue.description}</p>
                          <p className="text-xs text-blue-500 mt-0.5">💡 {issue.fix}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
