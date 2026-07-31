'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubjectSelector } from './_components/subject-selector'
import { isCustomSubject, formatCustomSubjectLabel, normalizeSubject } from '@/lib/subject-standards'

function displaySubject(subj: string): string {
  return isCustomSubject(subj) ? formatCustomSubjectLabel(subj) : subj
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
  const router = useRouter()

  const loadGoal = useCallback(async () => {
    try {
      const res = await fetch('/api/goal')
      const data = await res.json()
      if (data.goal) {
        setUniversity(data.goal.university)
        setMajor(data.goal.major)
        setExamDate(data.goal.examDate.split('T')[0])
        setSubjects(Array.isArray(data.goal.subjects) ? data.goal.subjects.map(normalizeSubject) : [])
        if (data.goal.targetScores && typeof data.goal.targetScores === 'object') {
          setTargetScores(data.goal.targetScores as Record<string, number>)
        }
        setSaved(true)
      }
    } catch { /* 未设置目标 */ }
  }, [])

  useEffect(() => { loadGoal() }, [loadGoal])

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
          university, major, examDate,
          subjects: subjectList,
          targetScores: Object.keys(targetScores).length > 0 ? targetScores : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const subjectList = subjects

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">设置考研目标</h1>
          <p className="text-gray-500 mt-1">填写你的目标信息，然后在学习计划中生成每周计划</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div>
            <label htmlFor="goal-university" className="block text-sm font-medium mb-1">目标院校</label>
            <input id="goal-university" type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              placeholder="例如：北京大学"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label htmlFor="goal-major" className="block text-sm font-medium mb-1">目标专业</label>
            <input id="goal-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label htmlFor="goal-exam-date" className="block text-sm font-medium mb-1">考试日期</label>
            <input id="goal-exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">考试科目</label>
            <SubjectSelector selected={subjects} onChange={setSubjects} />
          </div>

          {subjectList.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">🎯 各科目标分数（可选）</label>
              <div className="grid grid-cols-2 gap-3">
                {subjectList.map((subj) => (
                  <div key={subj} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-20 shrink-0 truncate" title={subj}>{displaySubject(subj)}</span>
                    <input type="number" value={targetScores[subj] || ''}
                      onChange={(e) => setTargetScores((prev) => ({ ...prev, [subj]: parseInt(e.target.value) || 0 }))}
                      min={0} max={150} placeholder="分数"
                      className="flex-1 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
                    <span className="text-xs text-gray-400">分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '保存中...' : saved ? '更新目标' : '保存目标'}
          </Button>
        </form>

        {saved && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border text-center space-y-3">
            <div className="text-4xl">✅</div>
            <h3 className="text-lg font-bold text-green-600">目标已保存</h3>
            <p className="text-sm text-gray-500">进入学习计划页面，设置各科进度并生成每周学习计划</p>
            <Button onClick={() => router.push('/tasks')} className="w-full">
              📋 管理学习计划
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
