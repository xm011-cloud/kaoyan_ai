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
  }, [])

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
