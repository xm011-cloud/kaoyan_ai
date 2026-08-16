'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { confirmDialog } from '@/stores/confirm-store'
import { cn } from '@/lib/utils'

interface Material {
  id: string
  name: string
  type: string
  size: number
  url: string
  content?: string | null
  createdAt: string
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 查看器状态
  const [viewing, setViewing] = useState<Material | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/materials')
      const data = await res.json()
      setMaterials(data.materials || [])
    } catch {
      // 加载失败
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')

      setMaterials(prev => [data.material, ...prev])
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleView = async (material: Material) => {
    setViewing(material)
    // 如果列表数据中已有 content，直接展示
    if (material.content != null) return

    // 否则从 API 加载完整内容
    setViewLoading(true)
    try {
      const res = await fetch(`/api/materials/${material.id}`)
      const data = await res.json()
      if (data.material) {
        setViewing(data.material)
      }
    } catch {
      // 忽略
    } finally {
      setViewLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: '删除资料',
      message: `确定删除「${name}」吗？`,
      confirmLabel: '删除',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/materials?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMaterials(prev => prev.filter(m => m.id !== id))
        if (viewing?.id === id) setViewing(null)
      }
    } catch {
      // 忽略
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split('T')[0]
  }

  const typeIcon = (type: string) => {
    if (type === 'pdf') return '📄'
    if (type.startsWith('word') || type === 'docx') return '📝'
    if (type.startsWith('image')) return '🖼️'
    if (type === 'text') return '📃'
    return '📁'
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="学习资料"
          subtitle="上传资料后可以在线查看，也可以让 AI 基于资料回答"
          action={
            // 文件框直接铺满按钮（absolute + opacity-0）——点击落点在 <input type=file> 本体，
            // 走原生用户手势打开选择器，不依赖程序化 .click() 或 label→input 转发，
            // iOS PWA standalone 下最稳（display:none + 程序化 click 会被 WebKit 屏蔽）。
            <label
              className={cn(
                buttonVariants({ variant: 'default' }),
                'relative cursor-pointer overflow-hidden',
                uploading && 'pointer-events-none opacity-50'
              )}
            >
              {uploading ? '上传中...' : '上传资料'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
                onChange={handleUpload}
                aria-label="上传资料"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          }
        />

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

        {/* Material list */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">📚</div>
              <p>还没有上传资料</p>
              <p className="text-sm">上传 PDF、Word、图片等资料，AI 可以帮你回答问题</p>
            </div>
          ) : (
            materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:shadow-sm transition-shadow"
              >
                <div className="text-2xl">{typeIcon(material.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{material.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(material.size)} · {formatDate(material.createdAt)}
                    {material.content && <span className="ml-2 text-success">· 可查看</span>}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleView(material)}
                  className="shrink-0"
                >
                  查看
                </Button>
                <button
                  onClick={() => handleDelete(material.id, material.name)}
                  className="text-muted-foreground hover:text-destructive text-sm shrink-0 px-1"
                  title="删除"
                  aria-label="删除"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 内容查看弹窗 ── */}
      {viewing && (
        <Modal
          open
          onClose={() => setViewing(null)}
          title={<span className="block truncate">{viewing.name}</span>}
          description={`${formatSize(viewing.size)} · ${formatDate(viewing.createdAt)} · ${viewing.type?.toUpperCase()}`}
          size="lg"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
                关闭
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // 复制全部内容
                  if (viewing.content) {
                    navigator.clipboard.writeText(viewing.content)
                  }
                }}
                disabled={!viewing.content}
              >
                📋 复制内容
              </Button>
            </>
          }
        >
              {viewLoading ? (
                <div className="text-center py-12 text-muted-foreground">加载中...</div>
              ) : viewing.content ? (
                <div className="bg-muted/50 rounded-xl p-4">
                  <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans break-words">
                    {viewing.content}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-3">{typeIcon(viewing.type)}</div>
                  <p>暂不支持预览此文件类型</p>
                  <p className="text-sm mt-1">
                    {viewing.type === 'pdf' && 'PDF 文件需要安装解析库才能提取文本'}
                    {viewing.type?.startsWith('word') && 'Word 文件需要文档解析器才能提取文本'}
                    {viewing.type?.startsWith('image') && '图片文件无法直接提取文本'}
                  </p>
                </div>
              )}
        </Modal>
      )}
    </div>
  )
}
