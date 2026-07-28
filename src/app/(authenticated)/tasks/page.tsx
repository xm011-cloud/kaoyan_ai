'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  title: string
  description?: string | null
  completed: boolean
  duration?: number
  phase?: string | null
  subject?: string | null
  date: string
}

const PHASES = ['基础阶段', '强化阶段', '冲刺阶段']

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // ── 编辑相关状态 ──
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editPhase, setEditPhase] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?date=${selectedDate}`)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      // 加载失败
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const loadAllTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      setAllTasks(data.tasks || [])
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'today') {
      loadTasks()
    } else {
      loadAllTasks()
      setLoading(false)
    }
  }, [viewMode, loadTasks, loadAllTasks])

  useEffect(() => {
    if (viewMode === 'today') loadTasks()
  }, [selectedDate, viewMode, loadTasks])

  const toggleTask = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      })
      const data = await res.json()
      if (res.ok) {
        setTasks(prev => prev.map(t => (t.id === task.id ? data.task : t)))
        setAllTasks(prev => prev.map(t => (t.id === task.id ? data.task : t)))
      }
    } catch {
      // 忽略
    }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          date: selectedDate,
          duration: newDuration ? parseInt(newDuration) : null,
          subject: null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTasks(prev => [...prev, data.task])
        setNewTitle('')
        setNewDuration('')
        setShowAdd(false)
      }
    } catch {
      // 忽略
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== id))
        setAllTasks(prev => prev.filter(t => t.id !== id))
      }
    } catch {
      // 忽略
    }
  }

  // ── 打开编辑弹窗 ──
  const openEdit = (task: Task) => {
    setEditTask(task)
    setEditTitle(task.title)
    setEditDesc(task.description || '')
    setEditDuration(task.duration?.toString() || '')
    setEditDate(task.date.split('T')[0])
    setEditPhase(task.phase || '')
    setEditSubject(task.subject || '')
  }

  // ── 保存编辑 ──
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTask || !editTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${editTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc || null,
          duration: editDuration ? parseInt(editDuration) : null,
          phase: editPhase || null,
          subject: editSubject || null,
          date: editDate,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTasks(prev => prev.map(t => (t.id === editTask.id ? data.task : t)))
        setAllTasks(prev => prev.map(t => (t.id === editTask.id ? data.task : t)))
        setEditTask(null)
      }
    } catch {
      // 忽略
    } finally {
      setSaving(false)
    }
  }

  const changeDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0)

  const groupedTasks = allTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.date.split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedTasks).sort()

  const totalAll = allTasks.length
  const completedAll = allTasks.filter(t => t.completed).length

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {viewMode === 'today' ? '今日任务' : '全部计划'}
            </h1>
            <p className="text-gray-500 mt-1">
              {viewMode === 'today'
                ? `${loading ? '加载中...' : `已完成 ${completedCount}/${tasks.length} · 预计 ${totalDuration} 分钟`}`
                : `总进度 ${completedAll}/${totalAll} · ${sortedDates.length} 天`
              }
            </p>
          </div>
          <div className="flex gap-2">
            {viewMode === 'today' ? (
              <>
                <Button variant="default" size="sm">今日</Button>
                <Button variant="outline" size="sm" onClick={() => setViewMode('all')}>全部</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setViewMode('today')}>今日</Button>
                <Button variant="default" size="sm">全部</Button>
              </>
            )}
          </div>
        </div>

        {/* 进度条 */}
        {viewMode === 'all' && totalAll > 0 && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="flex justify-between text-sm mb-2">
              <span>总进度</span>
              <span className="font-medium">{completedAll}/{totalAll} ({Math.round((completedAll/totalAll)*100)}%)</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all"
                style={{ width: `${(completedAll/totalAll)*100}%` }}
              />
            </div>
          </div>
        )}

        {/* 日期选择器 */}
        {viewMode === 'today' && (
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border">
            <button onClick={() => changeDate(-1)} className="text-gray-500 hover:text-blue-500 text-lg px-2">&larr;</button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 text-center px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <button onClick={() => changeDate(1)} className="text-gray-500 hover:text-blue-500 text-lg px-2">&rarr;</button>
            <Button size="sm" variant="outline" onClick={() => setSelectedDate(today)}>今天</Button>
          </div>
        )}

        {viewMode === 'today' && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? '取消' : '+ 添加任务'}
            </Button>
          </div>
        )}

        {showAdd && viewMode === 'today' && (
          <form onSubmit={addTask} className="flex gap-2 items-end bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">任务名称</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例如：复习高数第一章"
                className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium mb-1">时长(分钟)</label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="60"
                className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <Button type="submit" size="sm">添加</Button>
          </form>
        )}

        {/* 列表 */}
        {viewMode === 'today' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📋</div>
                <p>{selectedDate === today ? '今天还没有任务' : '这天没有安排任务'}</p>
                <p className="text-sm">AI 可以为你生成完整的学习计划</p>
              </div>
            ) : (
              tasks.map((task) => renderTask(task))
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {totalAll === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📋</div>
                <p>还没有创建学习计划</p>
                <p className="text-sm">在"我的目标"页面让 AI 为你生成学习计划</p>
              </div>
            ) : (
              sortedDates.map((date) => {
                const dayTasks = groupedTasks[date]
                const dayCompleted = dayTasks.filter(t => t.completed).length
                const isToday = date === today
                const phases = [...new Set(dayTasks.map(t => t.phase).filter(Boolean))]

                return (
                  <div key={date} className={`border rounded-lg overflow-hidden ${isToday ? 'border-blue-300 bg-blue-50/30 dark:border-blue-700 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {new Date(date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        </span>
                        {isToday && <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">今天</span>}
                      </div>
                      <span className="text-xs text-gray-500">
                        已完成 {dayCompleted}/{dayTasks.length}
                      </span>
                    </div>
                    <div className="divide-y dark:divide-gray-700">
                      {dayTasks.map((task) => renderTask(task))}
                    </div>
                    {phases.length > 0 && (
                      <div className="px-4 py-1.5 bg-gray-50/50 dark:bg-gray-800/30 text-xs text-gray-400">
                        阶段：{phases.join(' · ')}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ── 编辑弹窗 ── */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditTask(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">编辑任务</h3>
            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">标题</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">描述</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">时长(分钟)</label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">日期</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">阶段</label>
                  <select
                    value={editPhase}
                    onChange={(e) => setEditPhase(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">无</option>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">科目</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="例如：数学一"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  list="task-subjects"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditTask(null)}>
                  取消
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  function renderTask(task: Task) {
    return (
      <div
        key={task.id}
        className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 ${
          task.completed ? 'opacity-60' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task)}
          className="h-5 w-5 rounded border-gray-300 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)} title="点击编辑">
          <p className={task.completed ? 'line-through text-gray-400' : ''}>{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex gap-3 mt-1">
            {task.duration && (
              <span className="text-xs text-gray-500">{task.duration} 分钟</span>
            )}
            {task.subject && (
              <span className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 rounded">{task.subject}</span>
            )}
            {task.phase && (
              <span className="text-xs text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-1.5 rounded">{task.phase}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => openEdit(task)}
          className="text-gray-400 hover:text-blue-500 text-sm shrink-0 px-1"
          title="编辑"
        >
          ✎
        </button>
        <button
          onClick={() => deleteTask(task.id)}
          className="text-gray-400 hover:text-red-500 text-sm shrink-0"
          title="删除"
        >
          ✕
        </button>
      </div>
    )
  }
}
