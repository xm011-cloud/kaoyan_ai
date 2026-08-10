'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/avatar'

type ProfileStats = {
  totalDays: number
  totalMinutes: number
  thisWeekMinutes: number
  streak: number
}
type OwnProfile = {
  id: string
  name: string | null
  avatar: string | null
  email: string
  createdAt: string
  stats: ProfileStats
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('加载失败')
      const d = await res.json()
      setProfile(d)
      setName(d.name || '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      setProfile((p) => (p ? { ...p, avatar: data.avatarUrl } : p))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      setPreview(null)
    }
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('昵称不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setProfile((p) => (p ? { ...p, name: trimmed } : p))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">个人资料</h1>

      {/* 头像 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">头像</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar src={preview ?? profile?.avatar} name={profile?.name} size={72} />
          <label className="cursor-pointer">
            <span className="rounded-full bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70 inline-block">
              {uploading ? '上传中...' : '选择图片'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          <span className="text-xs text-muted-foreground">JPG / PNG / WebP，不超过 2MB</span>
        </div>
      </div>

      {/* 昵称 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">昵称</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="请输入昵称"
          className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 px-6 active:scale-[0.98] transition-all"
          >
            {saving ? '保存中...' : '保存'}
          </Button>
          {saved && <span className="text-sm text-success font-medium">✅ 已保存</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>

      {profile && (
        <p className="text-center text-sm text-muted-foreground">
          我的公开主页：
          <Link href={`/user/${profile.id}`} className="text-brand underline">
            查看
          </Link>
        </p>
      )}
    </div>
  )
}
