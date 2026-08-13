'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/avatar'

type ProfileStats = {
  totalDays: number
  totalMinutes: number
  thisWeekMinutes: number
  streak: number
}
type PublicProfile = {
  id: string
  name: string | null
  avatar: string | null
  createdAt: string
  stats: ProfileStats
}

// 他人公开资料页：昵称/头像/打卡统计，绝不渲染 email
export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError('')
    fetch(`/api/user/profile?userId=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true)
          return
        }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '加载失败')
        if (!cancelled) setProfile(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6 text-sm text-muted-foreground">加载中...</div>
  }
  if (notFound) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6 text-center">
        <p className="text-muted-foreground">用户不存在</p>
        <Link href="/leaderboard" className="text-brand text-sm underline">
          返回学习圈
        </Link>
      </div>
    )
  }
  if (error) {
    return <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6 text-destructive">{error}</div>
  }
  if (!profile) return null

  const stats = [
    { label: '累计打卡', value: `${profile.stats.totalDays} 天` },
    { label: '累计时长', value: `${profile.stats.totalMinutes} 分钟` },
    { label: '本周时长', value: `${profile.stats.thisWeekMinutes} 分钟` },
    { label: '连续打卡', value: `${profile.stats.streak} 天` },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 flex flex-col items-center gap-3">
        <Avatar src={profile.avatar} name={profile.name} size={96} />
        <h1 className="text-xl font-bold tracking-tight">{profile.name || '匿名用户'}</h1>
        <p className="text-xs text-muted-foreground">
          🕐 加入时间：
          {new Date(profile.createdAt).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 text-center">
            <p className="text-lg font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/leaderboard" className="underline">
          返回学习圈
        </Link>
      </p>
    </div>
  )
}
