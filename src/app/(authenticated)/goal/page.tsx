'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SubjectSelector } from './_components/subject-selector'
import { isCustomSubject, formatCustomSubjectLabel, normalizeSubject } from '@/lib/subject-standards'
import { MAJOR_SUBJECT_MAP, normalizeMajor, mergeMissingCorePublic } from '@/lib/major-subject-map'

function displaySubject(subj: string): string {
  return isCustomSubject(subj) ? formatCustomSubjectLabel(subj) : subj
}

export default function GoalPage() {
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [examDate, setExamDate] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [subjectsEdited, setSubjectsEdited] = useState(false)
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
        setSubjectsEdited(data.goal.subjectsEdited ?? false)
        if (data.goal.targetScores && typeof data.goal.targetScores === 'object') {
          setTargetScores(data.goal.targetScores as Record<string, number>)
        }
        setSaved(true)
      }
    } catch { /* 未设置目标 */ }
  }, [])

  useEffect(() => { loadGoal() }, [loadGoal])

  // 专业 → 科目自动填充：首次为空则填满推荐，已有则只补核心公共课；用户改过不再自动覆盖
  useEffect(() => {
    const key = normalizeMajor(major)
    if (!key || subjectsEdited) return
    const rec = MAJOR_SUBJECT_MAP[key].subjects
    setSubjects((prev) => (prev.length === 0 ? rec : mergeMissingCorePublic(prev, rec)))
  }, [major, subjectsEdited])

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
          subjectsEdited,
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
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <PageHeader title="考研目标" subtitle="填写你的目标信息，然后在学习计划中生成每周计划" />

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl border border-border/50">
          <div>
            <label htmlFor="goal-university" className="block text-sm font-medium mb-1">目标院校</label>
            <input id="goal-university" type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              placeholder="例如：北京大学"
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label htmlFor="goal-major" className="block text-sm font-medium mb-1">目标专业</label>
            <input id="goal-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术"
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label htmlFor="goal-exam-date" className="block text-sm font-medium mb-1">考试日期</label>
            <input id="goal-exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">考试科目</label>
            <SubjectSelector
              selected={subjects}
              onChange={setSubjects}
              majorValue={major}
              edited={subjectsEdited}
              onManualEdit={() => setSubjectsEdited(true)}
            />
          </div>

          {subjectList.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">🎯 各科目标分数（可选）</label>
              <div className="grid grid-cols-2 gap-3">
                {subjectList.map((subj) => (
                  <div key={subj} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20 shrink-0 truncate" title={subj}>{displaySubject(subj)}</span>
                    <input type="number" value={targetScores[subj] || ''}
                      onChange={(e) => setTargetScores((prev) => ({ ...prev, [subj]: parseInt(e.target.value) || 0 }))}
                      min={0} max={150} placeholder="分数"
                      className="flex-1 h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                    <span className="text-xs text-muted-foreground">分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '保存中...' : saved ? '更新目标' : '保存目标'}
          </Button>
        </form>

        {saved && (
          <div className="bg-card p-6 rounded-2xl border border-border/50 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <h3 className="text-lg font-bold text-success">目标已保存</h3>
            <p className="text-sm text-muted-foreground">进入学习计划页面，设置各科进度并生成每周学习计划</p>
            <Button onClick={() => router.push('/tasks')} className="w-full">
              🚀 去生成周计划
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
