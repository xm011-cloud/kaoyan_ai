'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChatMarkdown } from '@/components/chat-markdown'
import { AiWaiting } from '@/components/ai-waiting'
import { AiConfigBanner } from '@/components/ai-config-banner'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ProposalCard } from '@/components/proposal-card'
import type { Proposal } from '@/components/proposal-card'
import { cn } from '@/lib/utils'
import { useAiTask } from '@/hooks/use-ai-task'
import { useAiConfigStatus } from '@/hooks/use-ai-config-status'
import { useAiWorkspace } from '@/components/ai-workspace-context'
import { useGoal } from '@/hooks/use-goal'
import { useStudyContext } from '@/components/study-context'
import { SkillSuggestionChip } from '@/components/skill-suggestion'
import type { SkillSuggestionData } from '@/components/skill-suggestion'
import type { SkillStep } from '@/lib/skill-templates'

interface Source {
  id: string
  name: string
  score: number
  preview: string
  segments: string[]
}

interface ActionCard {
  type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated" | "planning_intake" | "milestone_review"
  title: string
  detail: string
  href?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  actions?: ActionCard[]
  reasoning?: string
  proposal?: Proposal
  suggestedSkill?: SkillSuggestionData
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

interface SkillBrief {
  id: string
  name: string
  icon: string
  description?: string
}

type RunningSkill = SkillBrief & { completed: boolean }
const EMPTY_SUBJECTS: string[] = []

function skillStepLabel(step: SkillStep, index: number): string {
  switch (step.type) {
    case 'data':
      return `读取数据：${(step as { sources?: string[] }).sources?.join('、') || '默认'}`
    case 'ask':
      return `提问：${(step as { question?: string }).question || ''}`
    case 'ai':
      return (step as { instruction?: string }).instruction || `AI 步骤 ${index + 1}`
    case 'note':
      return `记入档案${(step as { label?: string }).label ? `（${(step as { label?: string }).label}）` : ''}`
    case 'finish':
      return '结束技能'
    default:
      return `步骤 ${index + 1}`
  }
}

function looksLikeProblemQuestion(question: string) {
  const text = question.trim()
  if (text.length < 4) return false
  const nonProblem = ['计划', '安排', '制定', '规划', '进度', '目标', '打卡', '提醒', '创建', '设置', '你好', '谢谢']
  if (nonProblem.some((term) => text.includes(term))) return false
  return ['怎么做', '怎么解', '怎么求', '怎么算', '这道题', '题目', '解题', '答案', '求导', '积分', '极限', '矩阵', '方程', '概率']
    .some((term) => text.includes(term)) || /[∫√∑±≥≤×÷→∞^]/.test(text)
}

export function AiWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open, setOpen, width, toggle, toggleWidth, requestedPrompt, clearRequestedPrompt } = useAiWorkspace()
  const { context: studyContext } = useStudyContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [histories, setHistories] = useState<ChatHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [materials, setMaterials] = useState<MaterialBrief[]>([])
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set())
  const [showMaterials, setShowMaterials] = useState(false)
  const [userSkills, setUserSkills] = useState<SkillBrief[]>([])
  const [showSkillMenu, setShowSkillMenu] = useState(false)
  const [runningSkill, setRunningSkill] = useState<RunningSkill | null>(null)
  const [historiesLoaded, setHistoriesLoaded] = useState(false)
  const [skillsLoaded, setSkillsLoaded] = useState(false)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [distillPreview, setDistillPreview] = useState<{
    name: string
    description: string
    triggerKeywords: string[]
    steps: SkillStep[]
  } | null>(null)
  const [distillStatus, setDistillStatus] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [distillError, setDistillError] = useState<string | null>(null)
  const [wrongDraft, setWrongDraft] = useState<{ question: string; answer: string } | null>(null)
  const [wrongSubject, setWrongSubject] = useState('')
  const [wrongTags, setWrongTags] = useState('')
  const [savingWrong, setSavingWrong] = useState(false)
  const { phase: waitPhase, estimate: waitEstimate, start: waitStart, stop: waitStop, cancel: waitCancel } = useAiTask()
  const { configured: aiConfigured, markUnconfigured } = useAiConfigStatus()
  const { data: goal } = useGoal()
  const subjects = goal?.subjects ?? EMPTY_SUBJECTS

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const savedChatIdRef = useRef<string | null>(null)
  const handledRouteRequestRef = useRef<string | null>(null)

  // Hydration guard
  useEffect(() => { setMounted(true) }, [])

  // 右栏与 /chat 共用服务端对话记录，不再维护浮窗专属 localStorage 会话。
  const loadHistories = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setHistories(data.chats || [])
    } catch { /* ignore */ }
    finally { setHistoriesLoaded(true) }
  }, [])

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/materials?brief=1', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setMaterials(data.materials || [])
    } catch { /* ignore */ }
  }, [])

  const loadUserSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setUserSkills(data.skills || [])
    } catch { /* ignore */ }
    finally { setSkillsLoaded(true) }
  }, [])

  useEffect(() => {
    if (mounted) {
      loadHistories()
      loadMaterials()
      loadUserSkills()
    }
  }, [mounted, loadHistories, loadMaterials, loadUserSkills])

  useEffect(() => {
    if (skillsLoaded && input.startsWith('/')) {
      queueMicrotask(() => setShowSkillMenu(userSkills.length > 0))
    }
  }, [input, skillsLoaded, userSkills.length])

  useEffect(() => {
    if (!wrongSubject && subjects.length > 0) setWrongSubject(subjects[0])
  }, [subjects, wrongSubject])

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

  useEffect(() => {
    if (requestedPrompt) {
      setInput(requestedPrompt)
      clearRequestedPrompt()
    }
  }, [clearRequestedPrompt, requestedPrompt])

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
        toggle()
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

  const handleSubmit = async (e?: React.FormEvent, explicitText?: string) => {
    e?.preventDefault()
    const content = (explicitText ?? input).trim()
    if (!content || loading) return
    if (content === '/' && userSkills.length > 0) {
      setShowSkillMenu(true)
      return
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    const controller = waitStart()

    const pageContext = studyContext
      ? (() => {
          switch (studyContext.kind) {
            case 'course_lesson':
              return { kind: studyContext.kind, lessonId: studyContext.lessonId }
            case 'weekly_plan':
              return { kind: studyContext.kind, weekStart: studyContext.weekStart }
            case 'wrong_question':
              return { kind: studyContext.kind, wrongQuestionId: studyContext.wrongQuestionId }
            case 'practice_question':
              return { kind: studyContext.kind, sessionId: studyContext.sessionId, questionId: studyContext.questionId }
            case 'material':
              return { kind: studyContext.kind, materialId: studyContext.materialId }
          }
        })()
      : undefined

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          chatId: savedChatIdRef.current,
          ...(pageContext ? { pageContext } : {}),
          ...(selectedMaterialIds.size > 0 ? { materialIds: Array.from(selectedMaterialIds) } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('AI 服务暂不可用')

      const data = await res.json()

      // AI 未配置 / Key 失效 → 显示引导条，不追加普通回复
      if (data.needConfig) {
        markUnconfigured()
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || '请先在设置页面配置 AI API Key 后再试。',
        }])
        return
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || '抱歉，我暂时无法回答。',
        sources: data.sources,
        actions: data.actions,
        reasoning: data.reasoning,
        proposal: data.proposal,
        suggestedSkill: data.suggestedSkill,
      }
      if (data.skillRun?.completed) {
        setRunningSkill((current) => current ? { ...current, completed: true } : current)
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)

      // 与完整对话页保存到同一个服务端会话；提案也能在两个入口继续确认。
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
        loadHistories()
      } catch { /* save silently */ }
    } catch (err: unknown) {
      // 用户主动取消：安静收场，不追加错误消息
      if ((err as { name?: string })?.name === 'AbortError') return
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，AI 服务暂时不可用，请稍后再试。',
      }])
    } finally {
      waitStop()
      setLoading(false)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    savedChatIdRef.current = null
    setShowHistory(false)
    setRunningSkill(null)
    setDismissedSuggestions(new Set())
    setDistillError(null)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('chat')
    next.delete('skill')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    inputRef.current?.focus()
  }

  const loadChat = (history: ChatHistory) => {
    setMessages(history.messages)
    savedChatIdRef.current = history.id
    setShowHistory(false)
    setDismissedSuggestions(new Set())
    const kickoff = history.messages[0]
    if (kickoff?.role === 'user' && kickoff.content.startsWith('运行技能「')) {
      const name = kickoff.content.replace(/^运行技能「/, '').replace(/」$/, '')
      const skill = userSkills.find((item) => item.name === name)
      setRunningSkill({ id: skill?.id || '', name, icon: skill?.icon || '⚡', completed: false })
    } else {
      setRunningSkill(null)
    }
  }

  // 采纳/拒绝由 ProposalCard 直连确认接口；这里仅同步移除已处理卡片并保存统一会话。
  const handleProposalHandled = async (messageId: string) => {
    const nextMessages = messages.map((message) =>
      message.id === messageId ? { ...message, proposal: undefined } : message
    )
    setMessages(nextMessages)
    if (!savedChatIdRef.current) return
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: savedChatIdRef.current, messages: nextMessages }),
      })
      loadHistories()
    } catch { /* 下次打开会话时仍以服务端状态为准 */ }
  }

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startSkillRun = async (skill: SkillBrief) => {
    if (loading) return
    const kickoff: Message = { id: `skill_${Date.now()}`, role: 'user', content: `运行技能「${skill.name}」` }
    setShowSkillMenu(false)
    setMessages([kickoff])
    setInput('')
    setLoading(true)
    setRunningSkill({ ...skill, completed: false })
    const controller = waitStart()

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [kickoff], skillId: skill.id }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('AI 服务暂不可用')
      const data = await res.json()
      if (data.needConfig) {
        markUnconfigured()
        setRunningSkill(null)
        setMessages([kickoff, { id: `${Date.now()}_assistant`, role: 'assistant', content: data.reply || '请先配置 AI 后再运行技能。' }])
        return
      }
      const finalMessages: Message[] = [kickoff, {
        id: `${Date.now()}_assistant`,
        role: 'assistant',
        content: data.reply || '抱歉，我暂时无法回答。',
        sources: data.sources,
        actions: data.actions,
        reasoning: data.reasoning,
        proposal: data.proposal,
        suggestedSkill: data.suggestedSkill,
      }]
      setMessages(finalMessages)
      if (data.skillRun?.completed) setRunningSkill((current) => current ? { ...current, completed: true } : current)
      if (data.chatId) savedChatIdRef.current = data.chatId
      await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: savedChatIdRef.current, messages: finalMessages }),
      })
      loadHistories()
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setRunningSkill(null)
        return
      }
      setMessages([kickoff, { id: `${Date.now()}_assistant`, role: 'assistant', content: '抱歉，AI 服务暂时不可用，请稍后再试。' }])
      setRunningSkill((current) => current ? { ...current, completed: true } : current)
    } finally {
      waitStop()
      setLoading(false)
    }
  }

  const endSkill = () => {
    if (!runningSkill || runningSkill.completed || loading) return
    handleSubmit(undefined, '结束技能')
  }

  // /chat?chat= 与 /chat?skill= 在合并为右侧工作区后仍保持原链接语义。
  useEffect(() => {
    const chatId = searchParams.get('chat')
    const skillId = searchParams.get('skill')
    const requestKey = chatId ? `chat:${chatId}` : skillId ? `skill:${skillId}` : null
    if (!requestKey || handledRouteRequestRef.current === requestKey) return

    if (chatId && historiesLoaded) {
      handledRouteRequestRef.current = requestKey
      const history = histories.find((item) => item.id === chatId)
      if (history) queueMicrotask(() => loadChat(history))
      return
    }

    if (skillId && skillsLoaded) {
      handledRouteRequestRef.current = requestKey
      const skill = userSkills.find((item) => item.id === skillId)
      if (skill) queueMicrotask(() => startSkillRun(skill))
    }
  }, [histories, historiesLoaded, searchParams, skillsLoaded, userSkills]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDistill = async () => {
    if (distillStatus !== 'idle' || messages.length === 0) return
    setDistillStatus('loading')
    setDistillError(null)
    try {
      let targetChatId = savedChatIdRef.current
      if (!targetChatId) {
        const saveResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: null, messages }),
        })
        const saved = await saveResponse.json()
        if (!saveResponse.ok || !saved.chat?.id) throw new Error('无法创建对话')
        targetChatId = saved.chat.id
        savedChatIdRef.current = targetChatId
        loadHistories()
      }

      const response = await fetch('/api/skills/distill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDistillError(data.invalid ? data.reason || '这段对话不适合转成技能' : data.error || '蒸馏失败，请重试')
        return
      }
      setDistillPreview(data.skill)
    } catch {
      setDistillError('AI 服务暂时不可用，请稍后再试')
    } finally {
      setDistillStatus('idle')
    }
  }

  const confirmDistill = async () => {
    if (!distillPreview || distillStatus !== 'idle') return
    setDistillStatus('saving')
    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: distillPreview.name,
          description: distillPreview.description,
          triggerKeywords: distillPreview.triggerKeywords,
          steps: distillPreview.steps,
          source: 'user',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      setDistillPreview(null)
      loadUserSkills()
      router.push('/skills')
    } catch (error) {
      setDistillError(error instanceof Error ? error.message : '保存失败，请重试')
      setDistillStatus('idle')
    }
  }

  const saveWrongQuestion = async () => {
    if (!wrongDraft || !wrongSubject) return
    setSavingWrong(true)
    try {
      const res = await fetch('/api/wrong-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: wrongSubject,
          question: wrongDraft.question,
          answer: wrongDraft.answer,
          source: 'chat',
          sourceChatId: savedChatIdRef.current,
          tags: wrongTags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      setWrongDraft(null)
      setWrongTags('')
    } catch {
      // 保留表单内容，用户可直接再次提交。
    } finally {
      setSavingWrong(false)
    }
  }

  if (!mounted) return null

  return (
    <aside
        aria-hidden={!open}
        aria-label="AI 工作区"
        className={cn(
          // 小屏是独立全屏工作区；桌面才占用右栏宽度，避免输入区与内容互相遮挡。
          'fixed inset-0 z-[70] flex min-w-0 flex-col overflow-hidden bg-card lg:static lg:z-auto lg:shrink-0 lg:transition-[width,border-color] lg:duration-300 lg:ease-out',
          open
            ? 'flex lg:border-l lg:border-border/50 ' + (width === 'wide' ? 'lg:w-[min(46vw,620px)]' : 'lg:w-[400px]')
            : 'hidden lg:flex lg:w-0 lg:border-l-0',
        )}
      >
        {/* 头部 */}
        <div className="shrink-0 flex min-w-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-3 lg:min-w-[400px]">
          <div>
            <h2 className="text-sm font-semibold">AI 学习伙伴</h2>
            <p className="text-[10px] text-muted-foreground">理解当前学习现场，帮你走下一步</p>
          </div>
          <div className="flex items-center gap-1">
            {runningSkill && (
              runningSkill.completed ? (
                <span className="max-w-24 truncate px-1 text-[10px] text-muted-foreground">{runningSkill.icon} 已结束</span>
              ) : (
                <>
                  <span aria-label={`正在运行技能：${runningSkill.name}`} className="hidden max-w-28 truncate rounded-full bg-brand-muted px-2 py-1 text-[10px] text-brand sm:inline">{runningSkill.icon} 技能：{runningSkill.name}</span>
                  <button onClick={endSkill} disabled={loading} className="rounded-md px-2 py-1 text-[10px] text-brand hover:bg-brand-muted">结束技能</button>
                </>
              )
            )}
            <button
              onClick={toggleWidth}
              className="hidden min-h-11 items-center rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-muted lg:flex"
              title={width === 'wide' ? '收窄工作区' : '加宽工作区'}
            >
              {width === 'wide' ? '收窄' : '加宽'}
            </button>
            <button
              onClick={handleNewChat}
              className="min-h-11 flex items-center px-3 text-xs rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="新对话"
            >
              新对话
            </button>
            <button
              onClick={() => {
                setShowHistory((value) => !value)
                loadHistories()
              }}
              className="min-h-11 flex items-center px-3 text-xs rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="历史对话"
              aria-expanded={showHistory}
            >
              历史
            </button>
            <button
              onClick={() => setOpen(false)}
              className="min-h-11 flex items-center px-3 text-xs rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title="关闭 (Esc)"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="shrink-0 min-w-0 border-b border-border/50 bg-muted/40 px-4 py-3 lg:min-w-[400px]">
            <p className="mb-2 text-xs font-medium text-muted-foreground">历史对话</p>
            {histories.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无历史对话</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {histories.map((history) => (
                  <button
                    key={history.id}
                    onClick={() => loadChat(history)}
                    className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span className="mr-2 text-muted-foreground">{new Date(history.createdAt).toLocaleDateString('zh-CN')}</span>
                    {history.messages[0]?.content || '空对话'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {studyContext && (
            <div className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-xs">
              <p className="font-medium text-brand">正在协助：{studyContext.title}</p>
              <p className="mt-0.5 text-muted-foreground">{studyContext.detail}</p>
            </div>
          )}
          {!aiConfigured && messages.length === 0 && (
            <div className="flex flex-col justify-center h-full">
              <AiConfigBanner compact />
            </div>
          )}
          {!aiConfigured && messages.length > 0 && <AiConfigBanner compact />}
          {messages.length === 0 && aiConfigured && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-brand-muted text-lg font-semibold text-brand">AI</span>
              <p className="text-sm font-medium">从你正在做的事开始</p>
              <p className="mt-1 text-xs">试试这些：</p>
              <div className="grid grid-cols-1 gap-1.5 mt-3 w-full max-w-[280px]">
                {[
                  '帮我先梳理考研目标与当前基础，不要直接排任务',
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
              <a href="/goal#planning-intake" className="mt-4 text-xs font-medium text-brand hover:underline">先确认长期目标与基础 →</a>
            </div>
          )}

          {messages.map((msg, index) => {
            const isKickoff = msg.role === 'user' && msg.content.startsWith('运行技能「')
            if (isKickoff) {
              const name = msg.content.replace(/^运行技能「/, '').replace(/」$/, '')
              return <div key={msg.id} className="flex justify-center"><span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">⚡ 正在运行技能：{name}</span></div>
            }
            return (
              <div
                key={msg.id}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[90%] px-3 py-2 rounded-xl text-sm',
                    msg.role === 'user' ? 'bg-brand text-white' : 'bg-muted border border-border/50'
                  )}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      <ChatMarkdown
                        content={msg.content}
                        reasoning={msg.reasoning}
                        sources={msg.sources}
                        actions={msg.actions}
                        onSaveToWrongBook={
                          index > 0 && messages[index - 1]?.role === 'user' && looksLikeProblemQuestion(messages[index - 1].content)
                            ? (answer) => setWrongDraft({ question: messages[index - 1].content, answer })
                            : undefined
                        }
                      />
                      {msg.proposal && (
                        <ProposalCard
                          proposal={msg.proposal}
                          chatId={savedChatIdRef.current}
                          onHandled={() => handleProposalHandled(msg.id)}
                        />
                      )}
                      {msg.suggestedSkill && !dismissedSuggestions.has(msg.id) && (
                        <SkillSuggestionChip
                          suggestion={msg.suggestedSkill}
                          onRun={(skill) => startSkillRun(skill)}
                          onClose={() => setDismissedSuggestions((current) => new Set(current).add(msg.id))}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <AiWaiting phase={waitPhase} estimate={waitEstimate} onCancel={waitCancel} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-border/50 p-3"
        >
          {messages.length > 0 && (
            <div className="mb-2 flex items-center justify-end gap-2">
              {distillError && <span className="max-w-[65%] truncate text-[10px] text-destructive">{distillError}</span>}
              <button
                type="button"
                onClick={handleDistill}
                disabled={distillStatus !== 'idle' || loading}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/30 hover:text-brand disabled:opacity-40"
              >
                {distillStatus === 'loading' ? '蒸馏中…' : '💾 存为技能'}
              </button>
            </div>
          )}
          {materials.length > 0 && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowMaterials((value) => !value)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
                aria-expanded={showMaterials}
              >
                <span>📚</span>
                <span>{selectedMaterialIds.size ? `引用 ${selectedMaterialIds.size} 份资料` : '引用资料'}</span>
                <span className="text-[10px]">{showMaterials ? '▲' : '▼'}</span>
              </button>
              {showMaterials && (
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-2">
                  {materials.map((material) => (
                    <label key={material.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
                      <input type="checkbox" checked={selectedMaterialIds.has(material.id)} onChange={() => toggleMaterial(material.id)} />
                      <span className="truncate">{material.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                const value = e.target.value
                setInput(value)
                setShowSkillMenu(value.startsWith('/') && userSkills.length > 0)
              }}
              placeholder={aiConfigured ? "输入指令，AI 帮你执行..." : "配置 AI 后开启对话..."}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
              disabled={loading || !aiConfigured}
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || !aiConfigured}
              className="shrink-0 px-4 py-2 text-sm font-medium bg-brand text-white rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              发送
            </button>
          </div>
          {showSkillMenu && (
            <div role="menu" aria-label="运行技能" className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-card p-2 shadow-lg">
              {userSkills.map((skill) => (
                <button key={skill.id} type="button" role="menuitem" onClick={() => startSkillRun(skill)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                  <span>{skill.icon}</span><span className="truncate">{skill.name}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      {wrongDraft && (
        <Modal
          open
          onClose={() => setWrongDraft(null)}
          title="收录到错题本"
          footer={<><Button variant="outline" onClick={() => setWrongDraft(null)}>取消</Button><Button onClick={saveWrongQuestion} disabled={savingWrong || !wrongSubject}>{savingWrong ? '保存中...' : '确认收录'}</Button></>}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">仅保存题目、解析和你指定的科目；后续复习节奏仍由错题本管理。</p>
            <select value={wrongSubject} onChange={(event) => setWrongSubject(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="">选择科目</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <input value={wrongTags} onChange={(event) => setWrongTags(event.target.value)} placeholder="标签（可选，用逗号分隔）" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
        </Modal>
      )}
      {distillPreview && (
        <Modal
          open
          onClose={() => { setDistillPreview(null); setDistillError(null); setDistillStatus('idle') }}
          title="存为技能"
          description="AI 从这段对话中提炼出的可复用流程，可调整后保存。"
          footer={<><Button variant="outline" onClick={() => setDistillPreview(null)}>取消</Button><Button onClick={confirmDistill} disabled={distillStatus === 'saving' || !distillPreview.name.trim()}>{distillStatus === 'saving' ? '保存中…' : '保存技能'}</Button></>}
        >
          <div className="space-y-3">
            {distillError && <p className="text-xs text-destructive">{distillError}</p>}
            <label className="block text-sm font-medium">技能名称<input value={distillPreview.name} onChange={(event) => setDistillPreview({ ...distillPreview, name: event.target.value })} className="mt-1 w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" /></label>
            <label className="block text-sm font-medium">描述<input value={distillPreview.description} onChange={(event) => setDistillPreview({ ...distillPreview, description: event.target.value })} className="mt-1 w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" /></label>
            <label className="block text-sm font-medium">触发关键词<input value={distillPreview.triggerKeywords.join('，')} onChange={(event) => setDistillPreview({ ...distillPreview, triggerKeywords: event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) })} placeholder="例如：复盘，今日总结" className="mt-1 w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" /></label>
            <div><p className="text-sm font-medium">流程预览</p><ol className="mt-1 space-y-1.5">{distillPreview.steps.map((step, index) => <li key={`${step.type}-${index}`} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">{index + 1}. {skillStepLabel(step, index)}</li>)}</ol></div>
          </div>
        </Modal>
      )}
    </aside>
  )
}
