'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChatMarkdown } from '@/components/chat-markdown'
import { useGoal } from '@/hooks/use-goal'

interface Source {
  id: string;
  name: string;
  score: number;
  preview: string;
  segments: string[];
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

interface ChatHistory {
  id: string
  messages: Message[]
  createdAt: string
}

interface MaterialBrief {
  id: string
  name: string
  type: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [histories, setHistories] = useState<ChatHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 资料选择器
  const [materials, setMaterials] = useState<MaterialBrief[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMaterialPicker, setShowMaterialPicker] = useState(false)

  // 加入错题本弹窗
  const [saveWrongModal, setSaveWrongModal] = useState<{
    question: string
    answer: string
  } | null>(null)
  const [wrongSubject, setWrongSubject] = useState('')
  const [wrongTags, setWrongTags] = useState('')
  const { data: goal } = useGoal();
  const subjects = goal?.subjects ?? [];
  const [savingWrong, setSavingWrong] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 加载资料列表（用于选择器）
  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/materials?brief=1')
      const data = await res.json()
      setMaterials(data.materials || [])
    } catch { /* ignore */ }
  }, [])

  const loadHistories = useCallback(async () => {
    try {
      const res = await fetch('/api/chat')
      const data = await res.json()
      setHistories(data.chats || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadHistories()
    loadMaterials()
  }, [loadHistories, loadMaterials])

  // 科目加载后自动设置默认值
  useEffect(() => {
    if (subjects.length > 0 && !wrongSubject) {
      setWrongSubject(subjects[0]);
    }
  }, [subjects, wrongSubject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  const saveChat = useCallback(async (msgs: Message[], cId: string | null) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: cId, messages: msgs }),
      })
      const data = await res.json()
      if (res.ok && !cId) setChatId(data.chat.id)
      loadHistories()
    } catch { /* ignore */ }
  }, [loadHistories])

  const toggleMaterial = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllMaterials = () => {
    if (selectedIds.size === materials.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(materials.map(m => m.id)))
    }
  }

  const handleSaveToWrongBook = async () => {
    if (!saveWrongModal || !wrongSubject) return
    setSavingWrong(true)
    try {
      await fetch('/api/wrong-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: wrongSubject,
          question: saveWrongModal.question,
          answer: saveWrongModal.answer,
          source: 'chat',
          sourceChatId: chatId,
          tags: wrongTags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean),
        }),
      })
      setSaveWrongModal(null)
      setWrongTags('')
    } catch { /* ignore */ }
    finally { setSavingWrong(false) }
  }

  const openSaveWrongModal = (aiContent: string) => {
    // Find the last user message as the question
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    setSaveWrongModal({
      question: lastUserMsg?.content || '',
      answer: aiContent,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = { messages: newMessages }
      if (selectedIds.size > 0) {
        body.materialIds = Array.from(selectedIds)
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('AI 服务暂不可用')

      const data = await res.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || '抱歉，我暂时无法回答这个问题。',
        sources: data.sources,
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      saveChat(finalMessages, chatId)
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，AI 服务暂时不可用，请稍后再试。',
      }])
    } finally {
      setLoading(false)
    }
  }

  const loadChat = (history: ChatHistory) => {
    setMessages(history.messages)
    setChatId(history.id)
    setShowHistory(false)
  }

  const newChat = () => {
    setMessages([])
    setChatId(null)
  }

  const typeIcon = (t: string) => {
    if (t === 'pdf') return '📄'
    if (t === 'text') return '📃'
    if (t === 'word') return '📝'
    if (t === 'image') return '🖼️'
    return '📁'
  }

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b px-4 lg:px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-xl font-bold">AI 问答</h1>
          <p className="text-xs lg:text-sm text-gray-500">基于你的学习资料，AI 为你解答问题</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={newChat}>新对话</Button>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>历史</Button>
        </div>
      </div>

      {/* 历史对话 */}
      {showHistory && (
        <div className="shrink-0 border-b bg-gray-50 dark:bg-gray-800/50 px-4 lg:px-6 py-3">
          <div className="max-w-3xl mx-auto space-y-1">
            <h3 className="text-sm font-medium text-gray-500">历史对话</h3>
            {histories.length === 0 ? (
              <p className="text-sm text-gray-400">暂无历史对话</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {histories.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadChat(h)}
                    className="block w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm truncate"
                  >
                    <span className="text-gray-500 text-xs">
                      {new Date(h.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    {' '}
                    {Array.isArray(h.messages) && h.messages[0]?.content?.slice(0, 40) || '空对话'}...
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-5xl mb-4">💬</div>
            <p className="font-medium text-lg">开始提问吧</p>
            <p className="text-sm mt-1">上传资料后，AI 可以基于资料内容回答你的问题</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-md">
              {[
                '帮我制定复习计划',
                '这道题怎么解？',
                '帮我总结这份资料',
                '考前冲刺建议',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="px-3 py-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] lg:max-w-[75%] p-3 lg:p-4 rounded-xl ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border dark:border-gray-700'
              }`}
            >
              {message.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              ) : (
                <ChatMarkdown
                  content={message.content}
                  sources={message.sources}
                  onSaveToWrongBook={openSaveWrongModal}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t p-3 lg:p-4 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* 资料选择器 */}
          {materials.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowMaterialPicker(!showMaterialPicker)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500 transition-colors"
                >
                  <span>📚</span>
                  <span>
                    {selectedIds.size === 0
                      ? '引用资料（点击选择）'
                      : `已选 ${selectedIds.size}/${materials.length} 份资料`}
                  </span>
                  <span className="text-[10px]">{showMaterialPicker ? '▲' : '▼'}</span>
                </button>
                {showMaterialPicker && (
                  <button
                    onClick={selectAllMaterials}
                    className="text-[10px] text-gray-400 hover:text-blue-500"
                  >
                    {selectedIds.size === materials.length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>

              {showMaterialPicker && (
                <div className="flex flex-wrap gap-1.5">
                  {materials.map((m) => {
                    const isSelected = selectedIds.size === 0 || selectedIds.has(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMaterial(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                            : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 line-through opacity-50'
                        }`}
                      >
                        <span>{typeIcon(m.type)}</span>
                        <span className="max-w-[100px] truncate">{m.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedIds.size > 0 && (
                <p className="text-[10px] text-blue-500">
                  🤖 AI 将仅从你选中的资料中查找答案
                </p>
              )}
            </div>
          )}

          {/* 输入框 */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                materials.length === 0
                  ? "输入你的问题..."
                  : selectedIds.size > 0
                    ? "针对选中资料提问..."
                    : "输入问题，AI 自动检索所有资料..."
              }
              className="flex-1 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} className="px-5">
              发送
            </Button>
          </form>
          <p className="text-[10px] text-gray-400 text-center">
            AI 回答基于你的学习资料生成，请对重要信息进行核实
          </p>
        </div>
      </div>

      {/* ── 加入错题本弹窗 ── */}
      {saveWrongModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSaveWrongModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b dark:border-gray-700">
              <h3 className="font-bold text-lg">加入错题本</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                保存 AI 的回答以便后续复习
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">科目</label>
                <select
                  value={wrongSubject}
                  onChange={(e) => setWrongSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {subjects.length === 0 && <option value="">其他</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
                <input
                  value={wrongTags}
                  onChange={(e) => setWrongTags(e.target.value)}
                  placeholder="如：极限, 导数"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">你的问题</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs max-h-24 overflow-y-auto">
                  {saveWrongModal.question || '（无）'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI 回答</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs max-h-32 overflow-y-auto">
                  {saveWrongModal.answer.slice(0, 500)}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setSaveWrongModal(null)}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveToWrongBook}
                disabled={savingWrong || !wrongSubject}
              >
                {savingWrong ? '保存中...' : '保存到错题本'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
