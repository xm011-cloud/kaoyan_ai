'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const [aiKey, setAiKey] = useState('')
  const [aiUrl, setAiUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/settings')
        const data = await res.json()
        setHasKey(data.hasKey)
        setKeyHint(data.keyHint)
        if (data.aiUrl) setAiUrl(data.aiUrl)
        if (data.aiModel) setAiModel(data.aiModel)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    loadReminders()
    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifyPerm(Notification.permission)
    }
  }, [])

  const loadReminders = async () => {
    try {
      const res = await fetch('/api/user/reminders')
      const data = await res.json()
      setReminderEnabled(data.reminderEnabled)
      setReminderTime(data.reminderTime || '09:00')
      setReminderDays(data.reminderDays || ['1','2','3','4','5'])
    } catch { /* ignore */ }
  }

  const handleSaveReminders = async () => {
    setReminderSaving(true)
    try {
      await fetch('/api/user/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderEnabled, reminderTime, reminderDays }),
      })
      setReminderSaved(true)
      setTimeout(() => setReminderSaved(false), 3000)
    } catch { /* ignore */ }
    finally { setReminderSaving(false) }
  }

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      setNotifyPerm(perm)
    }
  }

  const toggleDay = (day: string) => {
    setReminderDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const dayLabels = ['一', '二', '三', '四', '五', '六', '日']

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiKey.trim()) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiKey, aiUrl: aiUrl || undefined, aiModel: aiModel || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')

      setSaved(true)
      setHasKey(true)
      setKeyHint(`${aiKey.slice(0, 6)}...${aiKey.slice(-4)}`)
      setShowKey(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('确定要移除已保存的 API Key 吗？移除后 AI 功能将无法使用。')) return

    try {
      const res = await fetch('/api/user/settings', { method: 'DELETE' })
      if (res.ok) {
        setHasKey(false)
        setKeyHint('')
        setAiKey('')
        setSaveMessage('')
      }
    } catch { /* ignore */ }
  }

  const [saveMessage, setSaveMessage] = useState('')

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">设置</h1>
          <p className="text-gray-500 mt-1">配置你的 AI 服务</p>
        </div>

        {/* AI 配置 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h2 className="font-bold">AI 服务配置</h2>
              <p className="text-sm text-gray-500">
                用你自己的 API Key 调用 AI 服务，各用各的配额不冲突
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 py-4">加载中...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              {hasKey && !showKey && (
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">✓</span>
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">API Key 已配置</p>
                      <p className="text-xs text-green-600/70 dark:text-green-400/70">{keyHint}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowKey(true); setAiKey(''); setHasKey(false) }}>
                      修改
                    </Button>
                    <button type="button" onClick={handleRemove} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">
                      移除
                    </button>
                  </div>
                </div>
              )}

              {(!hasKey || showKey) && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      在 MiMo/AI 平台获取，以 sk- 开头
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">API 地址（可选）</label>
                    <input
                      type="text"
                      value={aiUrl}
                      onChange={(e) => setAiUrl(e.target.value)}
                      placeholder="默认：https://api.xiaomimimo.com/v1"
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">模型（可选）</label>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="默认：mimo-v2.5-pro"
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}
              {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}

              {(!hasKey || showKey) && (
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? '保存中...' : '保存配置'}
                </Button>
              )}
            </form>
          )}
        </div>

        {/* 学习提醒 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔔</div>
            <div>
              <h2 className="font-bold">学习提醒</h2>
              <p className="text-sm text-gray-500">
                定时推送浏览器通知，提醒你开始学习
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">开启提醒</label>
              <button
                type="button"
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  reminderEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    reminderEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {reminderEnabled && (
              <>
                {/* Time picker */}
                <div>
                  <label className="block text-sm font-medium mb-1">提醒时间</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                {/* Day selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">重复日期</label>
                  <div className="flex gap-2">
                    {dayLabels.map((label, i) => {
                      const day = String(i + 1)
                      const active = reminderDays.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Notification permission */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">
                    浏览器通知：
                    {notifyPerm === 'granted' ? '✅ 已开启' : notifyPerm === 'denied' ? '❌ 已拒绝' : '⚠️ 未设置'}
                  </span>
                  {notifyPerm !== 'granted' && (
                    <Button type="button" variant="outline" size="sm" onClick={handleRequestPermission}>
                      开启通知
                    </Button>
                  )}
                </div>
              </>
            )}

            {reminderSaved && (
              <p className="text-sm text-green-600">✅ 提醒设置已保存</p>
            )}

            <Button
              type="button"
              onClick={handleSaveReminders}
              disabled={reminderSaving}
              className="w-full"
            >
              {reminderSaving ? '保存中...' : '保存提醒设置'}
            </Button>
          </div>
        </div>

        {/* 界面定制 */}
        <UISettings />

        {/* 提示 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p className="font-medium">💡 提示</p>
          <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
            <li>API Key 加密存储在你的数据库中，只有你自己能使用</li>
            <li>支持任何 OpenAI 兼容接口的 AI 服务（MiMo、DeepSeek、通义千问等）</li>
            <li>不提供 Key？发邮件要免费的</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── 界面定制组件 ──

import {
  useUIStore,
  DEFAULT_NAV_GROUPS,
  DEFAULT_WORKSPACE_CARDS,
  DEFAULT_PRACTICE_DEFAULTS,
} from '@/stores/ui-store'
import { defaultNavGroups } from '@/lib/nav'

function UISettings() {
  const {
    navGroups,
    workspaceCards,
    practiceDefaults,
    setNavGroups,
    setWorkspaceCards,
    setPracticeDefaults,
    resetNavToDefaults,
    resetWorkspaceToDefaults,
    resetPracticeToDefaults,
  } = useUIStore()
  const [savingUI, setSavingUI] = useState(false)

  // Sync to server
  const handleSaveUI = async () => {
    setSavingUI(true)
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navPreferences: navGroups,
          practicePreferences: practiceDefaults,
        }),
      })
      alert('✅ 界面偏好已保存')
    } catch {
      alert('❌ 保存失败')
    } finally {
      setSavingUI(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-6">
      <h2 className="text-lg font-bold">🎨 界面定制</h2>

      {/* 导航分组 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">侧边栏分组</h3>
          <button
            onClick={resetNavToDefaults}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            恢复默认
          </button>
        </div>
        <div className="space-y-2">
          {defaultNavGroups.map((template) => {
            const uiGroup = navGroups.find((g) => g.id === template.id)
            const visible = uiGroup?.visible ?? true

            return (
              <div key={template.id} className="border dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span>{template.icon}</span>
                  <span className="text-sm font-medium flex-1">{template.label}</span>
                  <button
                    onClick={() => {
                      const updated = navGroups.map((g) =>
                        g.id === template.id ? { ...g, visible: !visible } : g
                      )
                      // If group doesn't exist yet, add it
                      if (!navGroups.find((g) => g.id === template.id)) {
                        updated.push({
                          id: template.id,
                          label: template.label,
                          icon: template.icon,
                          visible: !visible,
                          items: template.items.map((i) => ({ href: i.href, visible: true })),
                        })
                      }
                      setNavGroups(updated)
                    }}
                    className={`text-xs px-2 py-0.5 rounded ${
                      visible
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
                    }`}
                  >
                    {visible ? '显示' : '隐藏'}
                  </button>
                </div>
                {visible && (
                  <div className="flex flex-wrap gap-1 ml-6">
                    {template.items.map((item) => {
                      const uiItem = uiGroup?.items.find((i) => i.href === item.href)
                      const itemVisible = uiItem?.visible ?? true
                      return (
                        <button
                          key={item.href}
                          onClick={() => {
                            const updated = navGroups.map((g) => {
                              if (g.id !== template.id) return g
                              const existing = g.items.find((i) => i.href === item.href)
                              return {
                                ...g,
                                items: existing
                                  ? g.items.map((i) =>
                                      i.href === item.href ? { ...i, visible: !itemVisible } : i
                                    )
                                  : [
                                      ...g.items,
                                      { href: item.href, visible: !itemVisible },
                                    ],
                              }
                            })
                            setNavGroups(updated)
                          }}
                          className={`text-xs px-2 py-1 rounded-full ${
                            itemVisible
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-gray-50 text-gray-300 dark:bg-gray-700/50 dark:text-gray-600 line-through'
                          }`}
                        >
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

      {/* 工作台卡片 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">工作台卡片</h3>
          <button
            onClick={resetWorkspaceToDefaults}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            恢复默认
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-2">拖拽排序暂不支持，请在下方调整显示/隐藏：</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_WORKSPACE_CARDS.map((cardId) => {
            const label = {
              stats: '📊 统计卡片',
              'today-tasks': '📋 今日任务',
              'quick-practice': '✏️ 快速练习',
              'study-trend': '📈 学习趋势',
              'recent-materials': '📚 最近资料',
              'wrong-overview': '🔴 错题概览',
              shortcuts: '🔗 快捷入口',
            }[cardId] || cardId

            const visible = workspaceCards.includes(cardId)

            return (
              <button
                key={cardId}
                onClick={() => {
                  setWorkspaceCards(
                    visible
                      ? workspaceCards.filter((c) => c !== cardId)
                      : [...workspaceCards, cardId]
                  )
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  visible
                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30'
                    : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-700/50 dark:text-gray-500'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 出题默认偏好 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">出题默认偏好</h3>
          <button
            onClick={resetPracticeToDefaults}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            恢复默认
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">默认模式</label>
            <select
              value={practiceDefaults.mode}
              onChange={(e) =>
                setPracticeDefaults({ mode: e.target.value as typeof practiceDefaults.mode })
              }
              className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="daily_review">🎯 今日巩固</option>
              <option value="spaced_review">🔄 间隔复习</option>
              <option value="mock_exam">⏱️ 模拟考试</option>
              <option value="material_based">📎 资料出题</option>
              <option value="custom">🔧 自由定制</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              默认难度：{Math.round(practiceDefaults.difficulty * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(practiceDefaults.difficulty * 100)}
              onChange={(e) =>
                setPracticeDefaults({ difficulty: parseInt(e.target.value) / 100 })
              }
              className="w-full accent-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">默认题数</label>
            <select
              value={practiceDefaults.count}
              onChange={(e) => setPracticeDefaults({ count: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">默认界面</label>
            <select
              value={practiceDefaults.uiMode}
              onChange={(e) =>
                setPracticeDefaults({ uiMode: e.target.value as typeof practiceDefaults.uiMode })
              }
              className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="simple">🎯 傻瓜模式</option>
              <option value="smart">⚡ 智能推荐</option>
              <option value="advanced">🔧 详细选项</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={practiceDefaults.includeWeakPoints}
                onChange={(e) => setPracticeDefaults({ includeWeakPoints: e.target.checked })}
                className="rounded"
              />
              涵盖错题
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={practiceDefaults.includeSpacedReview}
                onChange={(e) => setPracticeDefaults({ includeSpacedReview: e.target.checked })}
                className="rounded"
              />
              间隔复习
            </label>
          </div>
        </div>
      </div>

      {/* Save button */}
      <Button onClick={handleSaveUI} disabled={savingUI} className="w-full">
        {savingUI ? '保存中...' : '💾 保存界面偏好'}
      </Button>
    </div>
  )
}
