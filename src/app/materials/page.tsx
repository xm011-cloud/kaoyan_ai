'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Material {
  id: string
  name: string
  type: string
  size: string
  date: string
}

export default function MaterialsPage() {
  const [materials] = useState<Material[]>([
    { id: '1', name: '高数复习全书.pdf', type: 'pdf', size: '15.2 MB', date: '2026-07-10' },
    { id: '2', name: '英语词汇笔记.docx', type: 'word', size: '2.1 MB', date: '2026-07-09' },
    { id: '3', name: '政治思维导图.png', type: 'image', size: '5.8 MB', date: '2026-07-08' },
  ])

  const handleUpload = () => {
    // TODO: 实现文件上传
    console.log('Upload clicked')
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">学习资料</h1>
            <p className="text-gray-500 mt-1">上传资料后可以向 AI 提问</p>
          </div>
          <Button onClick={handleUpload}>上传资料</Button>
        </div>

        <div className="space-y-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-white dark:bg-gray-800"
            >
              <div className="text-2xl">
                {material.type === 'pdf' && '📄'}
                {material.type === 'word' && '📝'}
                {material.type === 'image' && '🖼️'}
              </div>
              <div className="flex-1">
                <p className="font-medium">{material.name}</p>
                <p className="text-sm text-gray-500">{material.size} · {material.date}</p>
              </div>
              <Button variant="outline" size="sm">查看</Button>
            </div>
          ))}

          {materials.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">📚</div>
              <p>还没有上传资料</p>
              <p className="text-sm">上传 PDF、Word、图片等资料，AI 可以帮你回答问题</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
