'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { confirmDialog } from '@/stores/confirm-store'
import { cn } from '@/lib/utils'
import { useStudyContext } from '@/components/study-context'
import { getMaterialReadiness } from '@/lib/material-readiness'
import { toast } from '@/stores/toast-store'

interface Material {
  id: string
  name: string
  type: string
  size: number
  url: string
  content?: string | null
  aiReady?: boolean
  createdAt: string
}

export default function MaterialsPage() {
  const { setContext } = useStudyContext()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [loadError, setLoadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 查看器状态
  const [viewing, setViewing] = useState<Material | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/materials')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '学习资料加载失败')
      setMaterials(data.materials || [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '学习资料加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    if (!viewing) {
      setContext(null)
      return
    }
    setContext({
      kind: 'material',
      materialId: viewing.id,
      title: `正在查看：${viewing.name}`,
      detail: `${viewing.type.toUpperCase()} · AI 将只按当前资料回答`,
    })
    return () => setContext(null)
  }, [setContext, viewing])

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

      setMaterials(prev => [{ ...data.material, aiReady: data.aiReady }, ...prev])
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '资料内容加载失败')
      if (data.material) setViewing(data.material)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '资料内容加载失败')
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '删除资料失败')
      setMaterials(prev => prev.filter(m => m.id !== id))
      if (viewing?.id === id) setViewing(null)
      toast.success('已删除资料')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除资料失败')
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

  const aiReadiness = (material: Material) => material.aiReady ?? getMaterialReadiness(material.content) === 'ready'
  const hasOriginalFile = (material: Material) => Boolean(material.url) && !material.url.startsWith('local:')

  return (
    <div className="workspace-page">
      <div className="mx-auto max-w-4xl space-y-7">
        <PageHeader
          title="学习资料与附件"
          subtitle="课程链接请放进课程学习；这里保存讲义、题单和附件。资料是否可被 AI 引用会明确标注，不影响你自己查看和记录。"
          action={
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
              <Link href="/courses?create=1" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 flex-1 sm:flex-none')}>
                添加课程链接
              </Link>
              {/* 透明 input 覆盖真实点击区域，保证移动端/PWA 也由原生手势打开选择器。 */}
              <label
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'relative min-h-11 flex-1 cursor-pointer overflow-hidden sm:flex-none',
                  uploading && 'pointer-events-none opacity-50'
                )}
              >
                {uploading ? '上传中...' : '上传附件'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={handleUpload}
                  aria-label="上传资料"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          }
        />

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => { setLoadError(''); setLoading(true); void loadMaterials() }}>重新加载</Button>
          </div>
        )}

        {/* Material list */}
        <section className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">📚</div>
              <p className="font-medium text-foreground">先放进你正在使用的学习资源</p>
              <p className="mt-1 text-sm">课程链接进入“课程学习”；讲义、题单和图片可以作为附件上传。上传并不等于 AI 一定能读取，但你仍可把它作为学习凭据和笔记来源。</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/courses?create=1" className={buttonVariants({ variant: 'outline' })}>添加课程链接</Link>
                <label className={cn(buttonVariants({ variant: 'default' }), 'relative cursor-pointer overflow-hidden')}>
                  上传附件
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt" onChange={handleUpload} aria-label="上传资料" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
            </div>
          ) : (
            materials.map((material) => (
              <div
                key={material.id}
                className="workspace-surface flex items-center gap-4 p-4 transition-shadow hover:shadow-md"
              >
                <div className="text-2xl">{typeIcon(material.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{material.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(material.size)} · {formatDate(material.createdAt)}
                    {aiReadiness(material)
                      ? <span className="ml-2 text-success">· AI 可引用</span>
                      : <span className="ml-2 text-warning">· 仅作学习附件</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {hasOriginalFile(material) && (
                    <a href={`/api/materials/${material.id}/file`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-10')}>
                      打开附件
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(material)}
                    className="min-h-10"
                  >
                    {aiReadiness(material) ? '查看摘录' : '查看说明'}
                  </Button>
                  <Link href={`/courses?create=1&material=${encodeURIComponent(material.id)}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-h-10')}>
                    放进课程
                  </Link>
                </div>
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
        </section>
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
              {hasOriginalFile(viewing) && <a href={`/api/materials/${viewing.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'sm' })}>打开附件</a>}
              <Button
                size="sm"
                onClick={() => {
                  if (viewing.content) {
                    void navigator.clipboard.writeText(viewing.content).then(() => toast.success('已复制文字摘录')).catch(() => toast.error('复制失败，请手动选择内容'))
                  }
                }}
                disabled={!viewing.content}
              >
                复制摘录
              </Button>
            </>
          }
        >
              {viewLoading ? (
                <div className="text-center py-12 text-muted-foreground">加载中...</div>
              ) : viewing.content && aiReadiness(viewing) ? (
                <div className="bg-muted/50 rounded-xl p-4">
                  <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans break-words">
                    {viewing.content}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-3">{typeIcon(viewing.type)}</div>
                  <p>这份附件暂不能提取为可检索文字</p>
                  <p className="text-sm mt-1">
                    {viewing.type === 'pdf' && '可能是扫描件或图片型 PDF；请上传可复制文字版，或补充文本摘录。'}
                    {viewing.type?.startsWith('word') && '请导出为可复制的 .txt 文本后上传。'}
                    {viewing.type?.startsWith('image') && '图片暂不能提取文字；请补充文本内容。'}
                    {viewing.type === 'other' && '当前格式暂不能提取文字；请补充文本内容。'}
                  </p>
                  <p className="mt-3 text-xs">它仍然可以作为学习附件保留；你可以从课程学习中记录本次学到的内容、易错点或解题思路。</p>
                </div>
              )}
        </Modal>
      )}
    </div>
  )
}
