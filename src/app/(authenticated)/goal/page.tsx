'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SubjectSelector } from './_components/subject-selector'
import { isCustomSubject, formatCustomSubjectLabel, normalizeSubject } from '@/lib/subject-standards'
import { MAJOR_SUBJECT_MAP, normalizeMajor, mergeMissingCorePublic } from '@/lib/major-subject-map'
import { PlanningIntakeCard } from './_components/planning-intake-card'

function displaySubject(subj: string): string {
  return isCustomSubject(subj) ? formatCustomSubjectLabel(subj) : subj
}

export default function GoalPage() {
  const [direction, setDirection] = useState('')
  const [goalStatus, setGoalStatus] = useState<'exploring' | 'tentative' | 'confirmed' | 'paused'>('exploring')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [examDate, setExamDate] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [subjectsEdited, setSubjectsEdited] = useState(false)
  const [targetScores, setTargetScores] = useState<Record<string, number>>({})
  const [weeklyHours, setWeeklyHours] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const loadGoal = useCallback(async () => {
    try {
      const res = await fetch('/api/goal')
      const data = await res.json()
      if (data.goal) {
        setDirection(data.goal.direction || '')
        setGoalStatus(data.goal.status || 'confirmed')
        setUniversity(data.goal.university || '')
        setMajor(data.goal.major || '')
        setExamDate(data.goal.examDate ? data.goal.examDate.split('T')[0] : '')
        setSubjects(Array.isArray(data.goal.subjects) ? data.goal.subjects.map(normalizeSubject) : [])
        setSubjectsEdited(data.goal.subjectsEdited ?? false)
        if (data.goal.targetScores && typeof data.goal.targetScores === 'object') {
          setTargetScores(data.goal.targetScores as Record<string, number>)
        }
        if (data.goal.studyLoad && typeof data.goal.studyLoad === 'object') {
          setWeeklyHours((data.goal.studyLoad as { weeklyHours?: number }).weeklyHours ?? null)
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
          direction, university, major, examDate: examDate || null,
          subjects: subjectList,
          targetScores: Object.keys(targetScores).length > 0 ? targetScores : undefined,
          studyLoad: { weeklyHours: weeklyHours ?? null },
          subjectsEdited,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setGoalStatus(data.goal.status)
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
        <PageHeader title="考研方向" subtitle="不必一次确定院校和日期，先保存方向，后续再逐步完善" />

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl border border-border/50">
          <div className="rounded-xl bg-brand/5 border border-brand/15 p-4">
            <p className="text-sm font-medium">
              {goalStatus === 'confirmed' ? '目标已确认' : goalStatus === 'tentative' ? '目标暂定中' : goalStatus === 'paused' ? '目标已暂停' : '目标探索中'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">院校、专业和考试日期可以稍后补充；未知信息不会由 AI 自动猜测。</p>
          </div>
          <div>
            <label htmlFor="goal-direction" className="block text-sm font-medium mb-1">学习方向</label>
            <input id="goal-direction" type="text" value={direction} onChange={(e) => setDirection(e.target.value)}
              placeholder="例如：计算机类考研"
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <p className="text-xs text-muted-foreground mt-1">还没确定学校时，先填写大致方向即可。</p>
          </div>
          <div>
            <label htmlFor="goal-university" className="block text-sm font-medium mb-1">目标院校（可选）</label>
            <input id="goal-university" type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              placeholder="例如：北京大学"
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label htmlFor="goal-major" className="block text-sm font-medium mb-1">目标专业（可选）</label>
            <input id="goal-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术"
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label htmlFor="goal-exam-date" className="block text-sm font-medium mb-1">考试日期（可选）</label>
            <input id="goal-exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">考试科目（可稍后完善）</label>
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

          <div>
            <label htmlFor="goal-weekly-hours" className="block text-sm font-medium mb-1">⏰ 每周可投入时间（可选）</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input id="goal-weekly-hours" type="number" min={0} max={80} value={weeklyHours ?? ''}
                onChange={(e) => setWeeklyHours(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="如 12"
                className="w-24 h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              <span className="text-xs text-muted-foreground">小时 / 周 —— 还在上课或有其他安排就填小一点，计划会按这个容量排任务，不会硬塞</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '保存中...' : saved ? '更新方向' : '保存并开始探索'}
          </Button>
        </form>

        {saved && (
          <>
            <PlanningIntakeCard />
            <div className="bg-card p-6 rounded-2xl border border-border/50 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <h3 className="text-lg font-bold text-success">{goalStatus === 'confirmed' ? '目标已确认' : '方向已保存'}</h3>
              <p className="text-sm text-muted-foreground">
                {goalStatus === 'confirmed' ? '接下来先设计并确认长期路线，再从当前阶段拆出本周行动' : '可以先建立探索路线，院校和考试科目之后再逐步确认'}
              </p>
              <Button onClick={() => router.push('/study-path')} className="w-full">
                🧭 去设计长期路线
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
