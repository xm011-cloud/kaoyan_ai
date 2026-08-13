'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from '@/stores/toast-store'
import { PageHeader } from '@/components/ui/page-header'
import {
  useUIStore, DEFAULT_NAV_GROUPS, DEFAULT_WORKSPACE_CARDS, DEFAULT_PRACTICE_DEFAULTS
} from '@/stores/ui-store'
import { defaultNavGroups } from '@/lib/nav'

type Tab = 'ai' | 'reminders' | 'ui'
type DrivingMode = 'auto' | 'assisted' | 'manual'

// 驾驶模式三档元数据（切档纪律：永不静默接管，给过渡摘要）
const DRIVING_MODES: Record<DrivingMode, { label: string; icon: string; desc: string; note: string }> = {
  auto: {
    label: '自动驾驶',
    icon: '🚀',
    desc: 'AI 更主动：周日在没有下周计划时自动生成，也可主动提批量建议（写入前仍会给你确认）。',
    note: '切档后：周日若下周无计划，会自动生成草稿，你随时可在任务页调整。',
  },
  assisted: {
    label: '辅助驾驶',
    icon: '🤝',
    desc: 'AI 与你协作：你提问时给建议，写入操作在你明确要求时才执行。',
    note: '切档后：维持当前行为，AI 不做额外主动操作。',
  },
  manual: {
    label: '手动驾驶',
    icon: '🕹️',
    desc: '你掌控一切：AI 只做顾问不动手，任何修改都由你决定。',
    note: '切档后：AI 不再主动提议批量操作，只回答问题与给建议。',
  },
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('ai')

  // ── AI settings ──
  const [aiKey, setAiKey] = useState('')
  const [aiUrl, setAiUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [drivingMode, setDrivingMode] = useState<DrivingMode>('assisted')
  const [aiTaskCount, setAiTaskCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [keyHint, setKeyHint] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)

  // ── Reminder settings ──
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderDays, setReminderDays] = useState<string[]>(['1','2','3','4','5'])
  const [reminderSaving, setReminderSaving] = useState(false)
  const [reminderSaved, setReminderSaved] = useState(false)
  const [notifyPerm, setNotifyPerm] = useState<string>('default')

  // ── UI settings ──
  const { navGroups, workspaceCards, practiceDefaults, showAiThinking, setNavGroups, setWorkspaceCards, setPracticeDefaults, setShowAiThinking, resetNavToDefaults, resetWorkspaceToDefaults, resetPracticeToDefaults } = useUIStore()
  const [uiSaving, setUiSaving] = useState(false)

  // ── Export ──
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/user/export')
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '导出失败') }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kaoyan-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    fetch('/api/user/settings').then(r => r.json()).then(d => {
      setHasKey(d.hasKey)
      setAiUrl(d.aiUrl || '')
      setAiModel(d.aiModel || '')
      setDrivingMode(d.drivingMode === 'auto' || d.drivingMode === 'manual' ? d.drivingMode : 'assisted')
      setAiTaskCount(d.aiTaskCount ?? 0)
      setKeyHint(d.keyHint || '')
      setLoading(false)
    })
  }, [])

  useEffect(() => { fetch('/api/user/reminders').then(r => r.json()).then(d => {
    setReminderEnabled(d.reminderEnabled ?? false)
    setReminderTime(d.reminderTime || '09:00')
    if (d.reminderDays?.length) setReminderDays(d.reminderDays)
  }).catch(() => {})}, [])
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setNotifyPerm(Notification.permission)
  }, [])

  // ── AI save ──
  const handleSaveAI = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/user/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiKey, aiUrl, aiModel }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '保存失败') }
      setSaved(true); setHasKey(true); setShowKey(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : '保存失败') }
    finally { setSaving(false) }
  }

  const handleDeleteAI = async () => {
    setSaving(true)
    await fetch('/api/user/settings', { method: 'DELETE' })
    setAiKey(''); setHasKey(false); setSaved(true); setShowKey(false)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  // ── Reminder save ──
  const handleSaveReminders = async () => {
    setReminderSaving(true)
    try {
      await fetch('/api/user/reminders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminderEnabled, reminderTime, reminderDays }) })
      setReminderSaved(true); setTimeout(() => setReminderSaved(false), 3000)
    } finally { setReminderSaving(false) }
  }

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return
    const p = await Notification.requestPermission()
    setNotifyPerm(p)
  }

  const toggleDay = (day: string) => setReminderDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  const dayLabels = ['一','二','三','四','五','六','日']

  // ── UI save ──
  const handleSaveUI = async () => {
    setUiSaving(true)
    try {
      const res = await fetch('/api/user/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ navPreferences: navGroups, practicePreferences: practiceDefaults, drivingMode }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '保存失败') }
      toast.success(`已切换为「${DRIVING_MODES[drivingMode].label}」。${DRIVING_MODES[drivingMode].note} 当前 ${aiTaskCount} 个 AI 生成的任务不会被改动。`)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : '保存失败') }
    finally { setUiSaving(false) }
  }

  const tabs = [
    { id: 'ai' as const, icon: '🤖', label: 'AI 配置' },
    { id: 'reminders' as const, icon: '🔔', label: '学习提醒' },
    { id: 'ui' as const, icon: '🎨', label: '界面定制' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="偏好设置" />

      {/* Tab bar — segmented control */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <span>{t.icon}</span> <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── AI Config Tab ── */}
      {tab === 'ai' && !loading && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold">🤖 AI 大模型配置</h2>
          <p className="text-sm text-muted-foreground">配置 AI 服务以使用 GPT/DeepSeek/MiMo 等大模型。不提供则使用系统默认。</p>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">API Key</label>
              <div className="flex gap-2">
                <input type={showKey ? 'text' : 'password'} value={aiKey}
                  onChange={e => setAiKey(e.target.value)}
                  placeholder={hasKey ? keyHint : 'sk-...'}
                  className="flex-1 h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <button onClick={() => setShowKey(!showKey)} className="h-11 w-11 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-[0.95] transition-all">{showKey ? '🙈' : '👁️'}</button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">API Base URL</label>
              <input type="text" value={aiUrl} onChange={e => setAiUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">模型名称</label>
              <input type="text" value={aiModel} onChange={e => setAiModel(e.target.value)}
                placeholder="gpt-4o / deepseek-chat / mimo-v2.5-pro"
                className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-success font-medium">✅ 已保存</p>}

          <div className="flex gap-2">
            <Button onClick={handleSaveAI} disabled={saving} className="rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 px-6 active:scale-[0.98] transition-all">
              {saving ? '保存中...' : '保存 AI 配置'}
            </Button>
            {hasKey && <Button variant="outline" onClick={handleDeleteAI} disabled={saving} className="rounded-full h-11 px-6 active:scale-[0.98] transition-all">移除配置</Button>}
          </div>

          <div className="bg-muted rounded-2xl p-4 text-sm space-y-1">
            <p className="font-medium">💡 支持的服务</p>
            <p className="text-muted-foreground text-xs">OpenAI / DeepSeek / MiMo / 通义千问 / 任何 OpenAI 兼容接口</p>
          </div>
        </div>
      )}

      {/* ── Reminders Tab ── */}
      {tab === 'reminders' && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold">🔔 学习提醒设置</h2>

          <div className="flex items-center justify-between">
            <span className="text-sm">启用提醒</span>
            <button onClick={() => setReminderEnabled(!reminderEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors ${reminderEnabled ? 'bg-brand' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {reminderEnabled && (
            <>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">提醒时间</label>
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  className="h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">重复日期</label>
                <div className="flex gap-2">
                  {dayLabels.map((l, i) => {
                    const d = String(i + 1); const a = reminderDays.includes(d)
                    return (
                      <button key={d} onClick={() => toggleDay(d)}
                        className={`w-10 h-10 rounded-full text-sm font-medium transition-all active:scale-[0.95] ${a ? 'bg-brand text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'}`}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">浏览器通知：{notifyPerm === 'granted' ? '✅ 已开启' : notifyPerm === 'denied' ? '❌ 已拒绝' : '⚠️ 未设置'}</span>
                {notifyPerm !== 'granted' && <Button variant="outline" size="sm" onClick={handleRequestPermission} className="rounded-full h-9 text-xs active:scale-[0.97]">开启通知</Button>}
              </div>
            </>
          )}

          {reminderSaved && <p className="text-sm text-success font-medium">✅ 已保存</p>}
          <Button onClick={handleSaveReminders} disabled={reminderSaving} className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all">
            {reminderSaving ? '保存中...' : '保存提醒设置'}
          </Button>
        </div>
      )}

      {/* ── UI Customization Tab ── */}
      {tab === 'ui' && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6 space-y-6">
          <h2 className="font-semibold">🎨 界面定制</h2>

          {/* 驾驶模式三档 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">🚗 驾驶模式</h3>
              <span className="text-xs text-muted-foreground">决定 AI 的主动程度</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DRIVING_MODES) as DrivingMode[]).map((m) => {
                const meta = DRIVING_MODES[m]
                return (
                  <button
                    key={m}
                    onClick={() => setDrivingMode(m)}
                    className={`p-3 rounded-xl border text-center transition-colors active:scale-[0.98] ${
                      drivingMode === m ? 'border-brand bg-brand-muted' : 'border-border/50 hover:bg-muted'
                    }`}
                  >
                    <div className="text-xl">{meta.icon}</div>
                    <div className={`text-sm font-medium mt-1 ${drivingMode === m ? 'text-brand' : ''}`}>{meta.label}</div>
                  </button>
                )
              })}
            </div>
            {/* 过渡摘要：永不静默接管 */}
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {DRIVING_MODES[drivingMode].desc}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80 leading-relaxed">
              ⚠️ {DRIVING_MODES[drivingMode].note} 当前有 {aiTaskCount} 个 AI 生成的任务，切档不会删除或覆盖它们。
            </p>
          </div>

          {/* Navigation groups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">侧边栏分组</h3>
              <button onClick={resetNavToDefaults} className="text-xs text-muted-foreground hover:text-foreground">恢复默认</button>
            </div>
            <div className="space-y-2">
              {defaultNavGroups.map((tmpl) => {
                const uiG = navGroups.find(g => g.id === tmpl.id)
                const vis = uiG?.visible ?? true
                return (
                  <div key={tmpl.id} className="rounded-xl border border-border/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{tmpl.icon}</span> <span className="text-sm font-medium flex-1">{tmpl.label}</span>
                      <button onClick={() => {
                        const up = navGroups.find(g => g.id === tmpl.id) ? navGroups.map(g => g.id === tmpl.id ? { ...g, visible: !vis } : g) : [...navGroups, { id: tmpl.id, label: tmpl.label, icon: tmpl.icon, visible: !vis, items: tmpl.items.map(i => ({ href: i.href, visible: true })) }]
                        setNavGroups(up)
                      }} className={`text-xs px-2 py-0.5 rounded-full ${vis ? 'bg-brand-muted text-brand' : 'bg-muted text-muted-foreground'}`}>
                        {vis ? '显示' : '隐藏'}
                      </button>
                    </div>
                    {vis && (
                      <div className="flex flex-wrap gap-1 ml-6">
                        {tmpl.items.map(item => {
                          const uiI = uiG?.items.find(i => i.href === item.href)
                          const iv = uiI?.visible ?? true
                          return (
                            <button key={item.href} onClick={() => {
                              setNavGroups(navGroups.map(g => {
                                if (g.id !== tmpl.id) return g
                                const ex = g.items.find(i => i.href === item.href)
                                return { ...g, items: ex ? g.items.map(i => i.href === item.href ? { ...i, visible: !iv } : i) : [...g.items, { href: item.href, visible: !iv }] }
                              }))
                            }} className={`text-xs px-2 py-1 rounded-full ${iv ? 'bg-brand-muted text-brand' : 'bg-muted text-muted-foreground line-through'}`}>
                              {item.icon} {item.shortLabel}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Workspace cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">工作台卡片</h3>
              <button onClick={resetWorkspaceToDefaults} className="text-xs text-muted-foreground hover:text-foreground">恢复默认</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_WORKSPACE_CARDS.map(cid => {
                const label: Record<string, string> = { stats: '📊 统计', 'today-tasks': '📋 任务', 'quick-practice': '✏️ 练习', 'study-trend': '📈 趋势', 'recent-materials': '📚 资料', 'wrong-overview': '🔴 错题', shortcuts: '🔗 快捷' }
                const vis = workspaceCards.includes(cid)
                return (
                  <button key={cid} onClick={() => setWorkspaceCards(vis ? workspaceCards.filter(c => c !== cid) : [...workspaceCards, cid])}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${vis ? 'border-brand/30 bg-brand-muted text-brand' : 'border-border/50 bg-muted text-muted-foreground'}`}>
                    {label[cid] || cid}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Practice defaults */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">出题默认偏好</h3>
              <button onClick={resetPracticeToDefaults} className="text-xs text-muted-foreground hover:text-foreground">恢复默认</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">默认模式</label>
                <select value={practiceDefaults.mode} onChange={e => setPracticeDefaults({ mode: e.target.value as typeof practiceDefaults.mode })}
                  className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-xs">
                  <option value="daily_review">🎯 今日巩固</option>
                  <option value="spaced_review">🔄 间隔复习</option>
                  <option value="mock_exam">⏱️ 模拟考试</option>
                  <option value="material_based">📎 资料出题</option>
                  <option value="custom">🔧 自由定制</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">难度 {Math.round(practiceDefaults.difficulty * 100)}%</label>
                <input type="range" min={0} max={100} value={Math.round(practiceDefaults.difficulty * 100)}
                  onChange={e => setPracticeDefaults({ difficulty: +e.target.value / 100 })}
                  className="w-full h-10 accent-brand" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">默认题数</label>
                <select value={practiceDefaults.count} onChange={e => setPracticeDefaults({ count: +e.target.value })}
                  className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-xs">
                  {[5,10,15,20].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">默认界面</label>
                <select value={practiceDefaults.uiMode} onChange={e => setPracticeDefaults({ uiMode: e.target.value as typeof practiceDefaults.uiMode })}
                  className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-xs">
                  <option value="simple">🎯 傻瓜模式</option>
                  <option value="smart">⚡ 智能推荐</option>
                  <option value="advanced">🔧 详细选项</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI 显示偏好 */}
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">显示 AI 思考过程</h3>
                <p className="text-xs text-muted-foreground mt-0.5">在 AI 回复上方展示可折叠的思考过程</p>
              </div>
              <button onClick={() => setShowAiThinking(!showAiThinking)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${showAiThinking ? 'bg-brand' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${showAiThinking ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          <Button onClick={handleSaveUI} disabled={uiSaving} className="w-full rounded-full bg-brand hover:bg-brand/90 text-brand-foreground font-semibold h-11 active:scale-[0.98] transition-all">
            {uiSaving ? '保存中...' : '💾 保存界面偏好'}
          </Button>
        </div>
      )}

      {/* 关于 / 支持 */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-6">
        <h2 className="font-semibold mb-3">❤️ 关于与支持</h2>
        <p className="text-sm text-muted-foreground mb-4">这个应用由作者一人业余开发、完全免费。你的反馈和一杯咖啡都是最好的支持。</p>
        <div className="flex gap-2 flex-wrap">
          <Link href="/suggestions">
            <Button variant="outline" className="rounded-full h-10 px-5 active:scale-[0.98] transition-all">💬 意见反馈</Button>
          </Link>
          <Link href="/support">
            <Button variant="outline" className="rounded-full h-10 px-5 active:scale-[0.98] transition-all">☕ 支持作者</Button>
          </Link>
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="rounded-full h-10 px-5 active:scale-[0.98] transition-all">
            {exporting ? '导出中...' : '💾 导出数据'}
          </Button>
        </div>
      </div>
    </div>
  )
}
