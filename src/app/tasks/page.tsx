'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  title: string
  completed: boolean
  duration?: number
}

export default function TasksPage() {
  const [tasks] = useState<Task[]>([
    { id: '1', title: '复习高数第一章 极限与连续', completed: false, duration: 60 },
    { id: '2', title: '背诵英语单词 List 5', completed: true, duration: 30 },
    { id: '3', title: '做政治选择题 100 道', completed: false, duration: 45 },
    { id: '4', title: '复习数据结构 树与二叉树', completed: false, duration: 90 },
  ])

  const completedCount = tasks.filter(t => t.completed).length
  const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0)

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">今日任务</h1>
            <p className="text-gray-500 mt-1">
              已完成 {completedCount}/{tasks.length} · 预计 {totalDuration} 分钟
            </p>
          </div>
          <Button variant="outline">生成新计划</Button>
        </div>

        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-4 rounded-lg border bg-white dark:bg-gray-800 ${
                task.completed ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => {}}
                className="h-5 w-5 rounded border-gray-300"
              />
              <div className="flex-1">
                <p className={task.completed ? 'line-through' : ''}>{task.title}</p>
                {task.duration && (
                  <p className="text-sm text-gray-500">{task.duration} 分钟</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
