'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChatMarkdown } from '@/components/chat-markdown'
import type { Proposal } from '@/components/proposal-card'
import { cn } from '@/lib/utils'

interface ActionCard {
  type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated"
  title: string
  detail: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ActionCard[]
  reasoning?: string
  proposal?: Proposal
}

const FLOATING_CHAT_ID = 'ai-floating' // 固定的对话 key（与 /chat 页面隔离）

export function AiFloating() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const savedChatIdRef = useRef<string | null>(null)

  // Hydration guard
  useEffect(() => { setMounted(true) }, [])

  // 恢复对话
  useEffect(() => {
    if (!mounted) return
    try {
      const saved = localStorage.getItem(FLOATING_CHAT_ID)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.messages && Array.isArray(parsed.messages)) {
          setMessages(parsed.messages)
          savedChatIdRef.current = parsed.chatId || null
        }
      }
    } catch { /* ignore */ }
  }, [mounted])

  // 保存对话
  const persistChat = useCallback((msgs: Message[], chatId: string | null) => {
    try {
      localStorage.setItem(FLOATING_CHAT_ID, JSON.stringify({ messages: msgs, chatId, savedAt: Date.now() }))
    } catch { /* ignore */ }
  }, [])

  // 滚动到底部
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Esc 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Cmd+J / Ctrl+J 切换
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 页面导航时关闭
  useEffect(() => {
    setOpen(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // 用 pathname 变化检测：通过监听 popstate
  useEffect(() => {
    const handler = () => setOpen(false)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, chatId: savedChatIdRef.current, floating: true }),
      })

      if (!res.ok) throw new Error('AI 服务暂不可用')

      const data = await res.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || '抱歉，我暂时无法回答。',
        actions: data.actions,
        reasoning: data.reasoning,
        proposal: data.proposal,
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)

      // 保存到 DB + localStorage（提案由服务端可能新建对话承载，用返回的 chatId 避免重复建对话）
      try {
        const targetChatId = data.chatId || savedChatIdRef.current
        const saveRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: targetChatId,
            messages: finalMessages,
          }),
        })
        const saveData = await saveRes.json()
        if (saveRes.ok && saveData.chat?.id) {
          savedChatIdRef.current = saveData.chat.id
        }
      } catch { /* save silently */ }

      persistChat(finalMessages, savedChatIdRef.current)
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

  const handleNewChat = () => {
    setMessages([])
    savedChatIdRef.current = null
    localStorage.removeItem(FLOATING_CHAT_ID)
    inputRef.current?.focus()
  }

  if (!mounted) return null

  return (
    <>
      {/* ── 浮动按钮 ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'fixed z-40 bottom-20 lg:bottom-6 right-4 lg:right-6',
            'flex items-center gap-1.5 px-3.5 py-2.5 rounded-full',
            'bg-brand text-white shadow-lg shadow-brand/25',
            'hover:shadow-xl hover:scale-105 active:scale-95',
            'transition-all duration-200',
            'text-sm font-medium'
          )}
          title="AI 助手 (Ctrl+J)"
        >
          <span className="text-lg leading-none">🤖</span>
          <span className="hidden sm:inline">AI</span>
        </button>
      )}

      {/* ── 遮罩 ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── 抽屉面板 ── */}
      <div
        aria-hidden={!open}
        className={cn(
          'fixed z-50 bg-card border-border/50 shadow-2xl flex flex-col transition-transform duration-300',
          // 桌面端：右侧滑出
          'lg:top-12 lg:right-0 lg:bottom-0 lg:w-[420px] lg:border-l lg:rounded-none',
          'lg:translate-x-0',
          open ? 'lg:translate-x-0' : 'lg:translate-x-full',
          // 移动端：底部弹出
          'max-lg:inset-x-0 max-lg:bottom-0 max-lg:h-[70vh] max-lg:rounded-t-2xl max-lg:border-t',
          open ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full',
        )}
      >
        {/* 移动端拖拽手柄 */}
        <div className="lg:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div>
            <h2 className="font-semibold text-sm">🤖 AI 助手</h2>
            <p className="text-[10px] text-muted-foreground">可查数据 · 管任务 · 答疑解惑</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="text-xs px-2 py-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="新对话"
            >
              新对话
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="关闭 (Esc)"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
              <span className="text-4xl mb-3">🤖</span>
              <p className="font-medium text-sm">AI 学习助手</p>
              <p className="text-xs mt-1">试试这些：</p>
              <div className="grid grid-cols-1 gap-1.5 mt-3 w-full max-w-[280px]">
                {[
                  '我今天有什么任务？',
                  '帮我创建一个复习任务',
                  '本周学了多久？',
                  '帮我打卡，今天状态不错',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs text-left px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[90%] px-3 py-2 rounded-xl text-sm',
                  msg.role === 'user'
                    ? 'bg-brand text-white'
                    : 'bg-muted border border-border/50'
                )}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <>
                    <ChatMarkdown
                      content={msg.content}
                      reasoning={msg.reasoning}
                      actions={msg.actions}
                    />
                    {msg.proposal && (
                      <div className="mt-2 p-2 rounded-lg bg-brand-muted/40 border border-brand/20 text-[11px] text-brand">
                        <p className="font-medium">📋 已生成任务提案（{msg.proposal.items.length} 项）</p>
                        <p className="mt-0.5 text-foreground/70">
                          快捷助手不直接落地批量任务，请到 AI 对话页逐项确认
                        </p>
                        <Link
                          href={`/chat?chat=${savedChatIdRef.current || ''}`}
                          className="mt-1.5 inline-block font-medium underline underline-offset-2 hover:opacity-80"
                        >
                          去确认 →
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border/50 px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-border/50 p-3 flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入指令，AI 帮你执行..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-brand text-white rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            发送
          </button>
        </form>
      </div>
    </>
  )
}
