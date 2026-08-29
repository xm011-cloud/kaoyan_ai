'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ChatMarkdown } from '@/components/chat-markdown'
import { ProposalCard } from '@/components/proposal-card'
import type { Proposal } from '@/components/proposal-card'
import { SkillSuggestionChip } from '@/components/skill-suggestion'
import type { SkillSuggestionData } from '@/components/skill-suggestion'
import type { SkillStep } from '@/lib/skill-templates'
import { useGoal } from '@/hooks/use-goal'
import { useAiTask } from '@/hooks/use-ai-task'
import { useAiConfigStatus } from '@/hooks/use-ai-config-status'
import { AiWaiting } from '@/components/ai-waiting'
import { AiConfigBanner } from '@/components/ai-config-banner'

interface Source {
  id: string;
  name: string;
  score: number;
  preview: string;
  segments: string[];
}

interface ActionCard {
  type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated";
  title: string;
  detail: string;
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

// 「加入错题本」只在该回答是对某道具体题的解法时才展示。
// 依据触发它的用户问题判断：计划/建议/操作类问题一律不展示，避免计划等回答下出现无关按钮。
function looksLikeProblemQuestion(q: string): boolean {
  const text = (q || '').trim()
  if (!text || text.length < 4) return false

  // 计划 / 建议 / 数据 / 操作类 → 非单道题
  const nonProblem = [
    '复习计划', '学习计划', '计划', '安排', '制定', '规划', '总结', '进度', '目标',
    '怎么学', '怎么复习', '怎么背', '怎么记', '怎么准备', '学习方法', '学习方案', '时间表',
    '打卡', '提醒', '创建', '设置', '删除', '导出', '生成', '帮我把', '帮我制定', '帮我安排', '帮我创建',
    '你好', '谢谢', '你是谁',
  ]
  if (nonProblem.some((k) => text.includes(k))) return false

  // 具体题解类
  const problem = [
    '怎么做', '怎么解', '怎么求', '怎么算',
    '如何做', '如何解', '如何求', '如何算',
    '这道题', '这个题', '这道', '题目', '解题', '解法', '答案',
    '求导', '求积分', '求极限', '求值', '证明', '计算',
    '积分', '导数', '极限', '微分', '矩阵', '向量', '方程', '不等式',
    '函数', '数列', '概率', '三角函数',
  ]
  if (problem.some((k) => text.includes(k))) return true

  // 数学符号兜底
  return /[∫√∑±≥≤×÷→∞^]/.test(text)
}

// 技能步骤 → 人类可读标签（蒸馏预览卡只读展示）
function skillStepLabel(s: SkillStep, i: number): string {
  switch (s.type) {
    case 'data': {
      const srcs = (s as { sources?: string[] }).sources || []
      return `📊 读取数据：${srcs.join('、') || '默认'}`
    }
    case 'ask':
      return `❓ 提问：${(s as { question?: string }).question || ''}`
    case 'ai':
      return `🤖 ${(s as { instruction?: string }).instruction || ''}`
    case 'note':
      return `📒 记入档案${(s as { label?: string }).label ? `（${(s as { label?: string }).label}）` : ''}`
    case 'finish':
      return `✅ 结束技能`
    default:
      return `步骤 ${i + 1}`
  }
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { phase: waitPhase, estimate: waitEstimate, start: waitStart, stop: waitStop, cancel: waitCancel } = useAiTask()
  const { configured: aiConfigured, markUnconfigured } = useAiConfigStatus()
  const [chatId, setChatId] = useState<string | null>(null)
  const [histories, setHistories] = useState<ChatHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 资料选择器
  const [materials, setMaterials] = useState<MaterialBrief[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMaterialPicker, setShowMaterialPicker] = useState(false)

  // 技能运行：用户技能列表（斜杠菜单）/ 运行中徽标 / 斜杠菜单开关
  const [userSkills, setUserSkills] = useState<SkillBrief[]>([])
  const [runningSkill, setRunningSkill] = useState<RunningSkill | null>(null)
  const [showSkillMenu, setShowSkillMenu] = useState(false)

  // 建议芯片已关闭的消息 id + 对话蒸馏（存为技能）预览
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [distillPreview, setDistillPreview] = useState<{
    name: string
    description: string
    triggerKeywords: string[]
    steps: SkillStep[]
  } | null>(null)
  const [distillStatus, setDistillStatus] = useState<'idle' | 'loading' | 'saving'>('idle')
  const [distillError, setDistillError] = useState<string | null>(null)

  // 从消息流识别技能对话：首条 kickoff → 恢复运行徽标（id 未知不影响——结束按钮走 chat.skillId 解析）
  const syncSkillBadge = (msgs: Message[]) => {
    const first = Array.isArray(msgs) ? msgs[0] : undefined
    if (first?.role === 'user' && first.content.startsWith('运行技能「')) {
      const name = first.content.replace(/^运行技能「/, '').replace(/」$/, '')
      setRunningSkill({ id: '', name, icon: '⚡', completed: false })
    } else {
      setRunningSkill(null)
    }
  }

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
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const skillMenuRef = useRef<HTMLDivElement>(null)
  const skillKickoffRef = useRef(false)

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

  // 用户技能列表（斜杠菜单 / ?skill= 启动解析）
  const loadUserSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills')
      const data = await res.json()
      setUserSkills(data.skills || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadHistories()
    loadMaterials()
    loadUserSkills()
  }, [loadHistories, loadMaterials, loadUserSkills])

  // 点击输入区外关闭斜杠菜单
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (skillMenuRef.current && !skillMenuRef.current.contains(e.target as Node)) {
        setShowSkillMenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 用户技能列表就绪后：若输入框已是「/」开头，自动展开斜杠菜单（避免列表晚于输入返回）
  useEffect(() => {
    if (userSkills.length > 0 && inputRef.current?.value.startsWith('/')) {
      setShowSkillMenu(true)
    }
  }, [userSkills])

  // Restore chat from URL params
  const restoredRef = useRef(false)
  useEffect(() => {
    const chatParam = searchParams.get('chat')
    if (!chatParam || restoredRef.current) return
    restoredRef.current = true
    // Wait for histories to load, then find and restore
    const tryRestore = async () => {
      await loadHistories()
      // Try fetching the specific chat
      try {
        const res = await fetch('/api/chat')
        const data = await res.json()
        const found = (data.chats || []).find((h: ChatHistory) => h.id === chatParam)
        if (found) {
          setMessages(found.messages)
          setChatId(found.id)
          syncSkillBadge(found.messages)
        }
      } catch { /* ignore */ }
    }
    tryRestore()
  }, [searchParams, loadHistories])

  // 科目加载后自动设置默认值
  useEffect(() => {
    if (subjects.length > 0 && !wrongSubject) {
      setWrongSubject(subjects[0]);
    }
  }, [subjects, wrongSubject]);

  // 新消息时自动滚到底部，但用户手动上翻历史时（不在底部附近）不打断
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // 键盘遮挡：输入区底部 padding 把钉底的输入框顶到键盘上方。
  //  - 优先用 visualViewport 测量（web/iOS 都稳定）
  //  - PWA 独立模式 vv 事件不触发 → 用"输入框聚焦 + 固定键盘高度(约40%屏高)"兜底
  const [kbPad, setKbPad] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    const signaled = { current: false }

    const computeVv = () => {
      if (!vv) return
      signaled.current = true
      // resize 模式(布局随键盘缩)差值≈0 不加padding 靠原生抬升；overlay 模式差值=键盘高度
      setKbPad(Math.max(0, (window.innerHeight || 0) - (vv.offsetTop || 0) - vv.height))
    }
    const computeFocus = () => {
      if (signaled.current) return // vv 已给信号，以测量为准（避免重复抬）
      const focused = inputRef.current && document.activeElement === inputRef.current
      setKbPad(focused ? Math.round((window.innerHeight || 800) * 0.4) : 0)
    }

    if (vv) vv.addEventListener('resize', computeVv)
    window.addEventListener('resize', computeVv)
    inputRef.current?.addEventListener('focus', computeFocus)
    inputRef.current?.addEventListener('blur', computeFocus)
    return () => {
      if (vv) vv.removeEventListener('resize', computeVv)
      window.removeEventListener('resize', computeVv)
      inputRef.current?.removeEventListener('focus', computeFocus)
      inputRef.current?.removeEventListener('blur', computeFocus)
    }
  }, [])

  const saveChat = useCallback(async (msgs: Message[], cId: string | null) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: cId, messages: msgs }),
      })
      const data = await res.json()
      if (res.ok && !cId) {
        const newId = data.chat.id
        setChatId(newId)
        router.replace(`${pathname}?chat=${newId}`, { scroll: false })
      }
      loadHistories()
    } catch { /* ignore */ }
  }, [loadHistories, router, pathname])

  // 提案采纳/拒绝后：从消息里移除提案卡并重存对话（持久化移除）
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages
  const handleProposalHandled = useCallback((messageId: string) => {
    const next = messagesRef.current.map((m) =>
      m.id === messageId ? { ...m, proposal: undefined } : m
    )
    setMessages(next)
    saveChat(next, chatId)
  }, [saveChat, chatId])

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

  const openSaveWrongModal = (question: string, aiContent: string) => {
    setSaveWrongModal({
      question: question || '',
      answer: aiContent,
    })
  }

  // 普通消息发送（含「结束技能」手动收尾；skillId 分支由 startSkillRun 处理）
  const sendText = async (text: string) => {
    if (!text.trim() || loading) return
    setShowSkillMenu(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    const controller = waitStart()

    try {
      const body: Record<string, unknown> = { messages: newMessages, chatId }
      if (selectedIds.size > 0) {
        body.materialIds = Array.from(selectedIds)
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        content: data.reply || '抱歉，我暂时无法回答这个问题。',
        sources: data.sources,
        actions: data.actions,
        reasoning: data.reasoning,
        proposal: data.proposal,
        suggestedSkill: data.suggestedSkill,
      }

      // 技能运行收尾（结束技能 / AI 调 finish）→ 徽标转「已结束」
      if (data.skillRun?.completed) {
        setRunningSkill((prev) => (prev ? { ...prev, completed: true } : prev))
      }

      // 提案可能由服务端新建对话承载（此时返回新 chatId），保持客户端一致避免重复建对话
      const resolvedChatId = data.chatId || chatId
      if (data.chatId && data.chatId !== chatId) {
        setChatId(data.chatId)
        router.replace(`${pathname}?chat=${data.chatId}`, { scroll: false })
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      saveChat(finalMessages, resolvedChatId)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendText(input)
  }

  // 启动一次技能运行：新对话 + kickoff 消息（运行技能「name」）+ skillId
  const startSkillRun = useCallback(async (skill: SkillBrief) => {
    if (loading) return
    setShowSkillMenu(false)
    const kickoffMsg: Message = {
      id: `skill_${Date.now()}`,
      role: 'user',
      content: `运行技能「${skill.name}」`,
    }
    const newMessages = [kickoffMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setRunningSkill({ id: skill.id, name: skill.name, icon: skill.icon, completed: false })
    const controller = waitStart()

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, skillId: skill.id }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('AI 服务暂不可用')
      const data = await res.json()

      // AI 未配置 / Key 失效 → 显示引导条，放弃技能运行
      if (data.needConfig) {
        markUnconfigured()
        setRunningSkill(null)
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || '请先在设置页面配置 AI API Key 后再运行技能。',
        }])
        return
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || '抱歉，我暂时无法回答这个问题。',
        sources: data.sources,
        actions: data.actions,
        reasoning: data.reasoning,
        proposal: data.proposal,
        suggestedSkill: data.suggestedSkill,
      }

      if (data.skillRun?.completed) {
        setRunningSkill((prev) => (prev ? { ...prev, completed: true } : prev))
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)

      // 技能对话由服务端创建（带 skillId）→ 返回新 chatId，同步 URL + 持久化
      if (data.chatId) {
        setChatId(data.chatId)
        router.replace(`${pathname}?chat=${data.chatId}`, { scroll: false })
        saveChat(finalMessages, data.chatId)
      }
    } catch (err: unknown) {
      // 用户主动取消：放弃这次技能运行，不追加错误消息
      if ((err as { name?: string })?.name === 'AbortError') {
        setRunningSkill(null)
        return
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，AI 服务暂时不可用，请稍后再试。',
      }])
      setRunningSkill((prev) => (prev ? { ...prev, completed: true } : prev))
    } finally {
      waitStop()
      setLoading(false)
    }
  }, [loading, pathname, router, saveChat, waitStart, waitStop])

  // ?skill=<id> 启动：等用户技能列表就绪后自动跑一次
  useEffect(() => {
    const skillParam = searchParams.get('skill')
    if (!skillParam || skillKickoffRef.current) return
    if (userSkills.length === 0) return // 等列表（含模板播种）加载
    skillKickoffRef.current = true
    restoredRef.current = true // 技能对话已加载，禁止 restore 效果再拉一次
    const skill = userSkills.find((s) => s.id === skillParam)
    if (!skill) {
      router.replace(pathname, { scroll: false })
      return
    }
    startSkillRun(skill)
  }, [searchParams, userSkills, pathname, router, startSkillRun])

  // 斜杠菜单选择技能 → 启动
  const pickSkill = (skill: SkillBrief) => {
    setShowSkillMenu(false)
    startSkillRun(skill)
  }

  // 手动结束当前技能运行
  const endSkill = () => {
    if (!runningSkill || runningSkill.completed || loading) return
    sendText('结束技能')
  }

  // ── 对话蒸馏：把当前对话存成技能（无 chatId 先保存一次拿到 id）──
  const handleDistill = async () => {
    if (distillStatus !== 'idle') return
    setDistillStatus('loading')
    setDistillError(null)
    try {
      let targetChatId = chatId
      if (!targetChatId) {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: null, messages }),
        })
        const data = await res.json()
        if (!res.ok || !data.chat?.id) throw new Error('无法创建对话')
        targetChatId = data.chat.id
        setChatId(targetChatId)
        router.replace(`${pathname}?chat=${targetChatId}`, { scroll: false })
        loadHistories()
      }

      const distillRes = await fetch('/api/skills/distill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId }),
      })
      const distillData = await distillRes.json()
      if (!distillRes.ok) {
        if (distillData.invalid) {
          setDistillError(distillData.reason || '这段对话不适合转成技能')
        } else {
          setDistillError(distillData.error || '蒸馏失败，请重试')
        }
        return
      }
      setDistillPreview(distillData.skill)
    } catch {
      setDistillError('AI 服务暂时不可用，请稍后再试')
    } finally {
      setDistillStatus('idle')
    }
  }

  // 预览确认 → 保存技能 → 跳技能架
  const confirmDistill = async () => {
    if (!distillPreview || distillStatus !== 'idle') return
    setDistillStatus('saving')
    try {
      const res = await fetch('/api/skills', {
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      setDistillPreview(null)
      loadUserSkills()
      router.push('/skills')
    } catch (err) {
      setDistillError(err instanceof Error ? err.message : '保存失败，请重试')
      setDistillStatus('idle')
    }
  }

  const loadChat = (history: ChatHistory) => {
    setMessages(history.messages)
    setChatId(history.id)
    setShowHistory(false)
    router.replace(`${pathname}?chat=${history.id}`, { scroll: false })
    syncSkillBadge(history.messages)
  }

  const newChat = () => {
    setMessages([])
    setChatId(null)
    setRunningSkill(null)
    router.replace(pathname, { scroll: false })
  }

  const typeIcon = (t: string) => {
    if (t === 'pdf') return '📄'
    if (t === 'text') return '📃'
    if (t === 'word') return '📝'
    if (t === 'image') return '🖼️'
    return '📁'
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-4 lg:px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-xl font-bold">AI 对话</h1>
          <p className="text-xs lg:text-sm text-muted-foreground">AI 助手，可以查数据、管任务、答疑解惑</p>
        </div>
        <div className="flex items-center gap-2">
          {runningSkill && (
            runningSkill.completed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                {runningSkill.icon} {runningSkill.name} · 技能已结束 ✓
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-muted text-brand text-xs">
                  {runningSkill.icon} 技能：{runningSkill.name}
                </span>
                <Button variant="outline" size="sm" onClick={endSkill} disabled={loading}>
                  结束技能
                </Button>
              </>
            )
          )}
          <Button variant="outline" size="sm" onClick={newChat}>新对话</Button>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>历史</Button>
        </div>
      </div>

      {/* 历史对话 */}
      {showHistory && (
        <div className="shrink-0 border-b border-border/50 bg-muted/50 px-4 lg:px-6 py-3">
          <div className="max-w-3xl mx-auto space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">历史对话</h3>
            {histories.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">暂无历史对话</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {histories.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadChat(h)}
                    className="block w-full text-left p-2 rounded hover:bg-muted text-sm truncate"
                  >
                    <span className="text-muted-foreground text-xs">
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
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto min-h-0 px-4 lg:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
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
                  className="px-3 py-2 text-xs text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, idx) => {
          // 触发该回答的用户问题（紧邻的前一条 user 消息）
          const prevUser = idx > 0 && messages[idx - 1].role === 'user' ? messages[idx - 1].content : ''
          const canSaveWrong = message.role === 'assistant' && looksLikeProblemQuestion(prevUser)
          // 技能启动消息（运行技能「name」）→ 居中系统提示条，不渲染为普通用户气泡
          const isKickoff = message.role === 'user' && message.content.startsWith('运行技能「')
          if (isKickoff) {
            const skillName = message.content.replace(/^运行技能「/, '').replace(/」$/, '')
            return (
              <div key={message.id} className="w-full flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 text-xs text-muted-foreground">
                  ⚡ 正在运行技能：{skillName}
                </div>
              </div>
            )
          }
          return (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] lg:max-w-[75%] p-3 lg:p-4 rounded-xl ${
                message.role === 'user'
                  ? 'bg-brand text-white'
                  : 'bg-card border border-border/50'
              }`}
            >
              {message.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              ) : (
                <>
                  <ChatMarkdown
                    content={message.content}
                    reasoning={message.reasoning}
                    sources={message.sources}
                    actions={message.actions}
                    onSaveToWrongBook={canSaveWrong
                      ? (aiContent: string) => openSaveWrongModal(prevUser, aiContent)
                      : undefined}
                  />
                  {message.proposal && (
                    <ProposalCard
                      proposal={message.proposal}
                      chatId={chatId}
                      onHandled={() => handleProposalHandled(message.id)}
                    />
                  )}
                  {message.suggestedSkill && !dismissedSuggestions.has(message.id) && (
                    <SkillSuggestionChip
                      suggestion={message.suggestedSkill}
                      onRun={(s) => startSkillRun(s)}
                      onClose={() =>
                        setDismissedSuggestions((prev) => new Set(prev).add(message.id))
                      }
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

      {/* Input area —— paddingBottom 随 iOS 键盘高度抬升，避免遮挡 */}
      <div className="shrink-0 border-t border-border/50 p-3 lg:p-4 bg-card" style={{ paddingBottom: kbPad > 0 ? kbPad : undefined }}>
        <div className="max-w-3xl mx-auto space-y-2">
          {/* 资料选择器 */}
          {materials.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowMaterialPicker(!showMaterialPicker)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand transition-colors"
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
                    className="text-[10px] text-muted-foreground hover:text-brand"
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
                            ? 'bg-brand-muted border-brand/30 text-brand'
                            : 'bg-muted/50 border-border/50 text-muted-foreground line-through opacity-50'
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
                <p className="text-[10px] text-brand">
                  🤖 AI 将仅从你选中的资料中查找答案
                </p>
              )}
            </div>
          )}

          {/* 对话蒸馏：存为技能 */}
          {messages.length > 0 && (
            <div className="flex items-center justify-end">
              {distillError && (
                <span className="mr-2 text-[10px] text-destructive max-w-[60%] truncate">
                  {distillError}
                </span>
              )}
              <button
                onClick={handleDistill}
                disabled={distillStatus !== 'idle' || loading}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {distillStatus === 'loading' ? '⏳ 蒸馏中...' : '💾 存为技能'}
              </button>
            </div>
          )}

          {/* 输入框 */}
          <div className="relative space-y-2">
            {!aiConfigured && <AiConfigBanner />}
            {showSkillMenu && (
              <div
                ref={skillMenuRef}
                role="menu"
                aria-label="运行技能"
                className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-20"
              >
                <p className="px-3 py-2 text-[10px] text-muted-foreground border-b border-border/50 bg-muted/30">
                  ⚡ 运行技能（输入 / 唤起）
                </p>
                {userSkills.map((s) => (
                  <button
                    key={s.id}
                    role="menuitem"
                    onClick={() => pickSkill(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
                  >
                    <span>{s.icon}</span>
                    <span className="flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">运行 →</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  const v = e.target.value
                  setInput(v)
                  setShowSkillMenu(v.startsWith('/') && userSkills.length > 0)
                }}
                placeholder={
                  materials.length === 0
                    ? "输入你的问题...（输入 / 可运行技能）"
                    : selectedIds.size > 0
                      ? "针对选中资料提问..."
                      : "输入问题，AI 自动检索所有资料..."
                }
                className="flex-1 px-4 py-2.5 text-sm border border-border/50 rounded-xl bg-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                disabled={loading || !aiConfigured}
              />
              <Button type="submit" disabled={loading || !input.trim() || !aiConfigured} className="px-5">
                发送
              </Button>
            </form>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            AI 回答基于你的学习资料生成，请对重要信息进行核实
          </p>
        </div>
      </div>

      {/* ── 加入错题本弹窗 ── */}
      {saveWrongModal && (
        <Modal
          open
          onClose={() => setSaveWrongModal(null)}
          title="加入错题本"
          description="保存 AI 的回答以便后续复习"
          footer={
            <>
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
            </>
          }
        >
          <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">科目</label>
                <select
                  value={wrongSubject}
                  onChange={(e) => setWrongSubject(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                  className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">你的问题</label>
                <div className="bg-muted/50 rounded-xl p-3 text-xs max-h-24 overflow-y-auto">
                  {saveWrongModal.question || '（无）'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI 回答</label>
                <div className="bg-muted/50 rounded-xl p-3 text-xs max-h-32 overflow-y-auto">
                  {saveWrongModal.answer.slice(0, 500)}
                </div>
              </div>
          </div>
        </Modal>
      )}

      {/* ── 对话蒸馏预览：存为技能 ── */}
      {distillPreview && (
        <Modal
          open
          onClose={() => {
            setDistillPreview(null)
            setDistillError(null)
            setDistillStatus('idle')
          }}
          title="💾 存为技能"
          description="AI 从这段对话里提炼出的可复用流程，可微调后保存"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDistillPreview(null)
                  setDistillError(null)
                  setDistillStatus('idle')
                }}
              >
                取消
              </Button>
              <Button
                onClick={confirmDistill}
                disabled={distillStatus === 'saving' || !distillPreview.name.trim()}
              >
                {distillStatus === 'saving' ? '保存中...' : '保存技能'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {distillError && <p className="text-xs text-destructive">{distillError}</p>}
            <div>
              <label className="block text-sm font-medium mb-1">技能名称</label>
              <input
                value={distillPreview.name}
                onChange={(e) => setDistillPreview({ ...distillPreview, name: e.target.value })}
                className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <input
                value={distillPreview.description}
                onChange={(e) =>
                  setDistillPreview({ ...distillPreview, description: e.target.value })
                }
                className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">触发关键词（逗号分隔）</label>
              <input
                value={distillPreview.triggerKeywords.join('，')}
                onChange={(e) =>
                  setDistillPreview({
                    ...distillPreview,
                    triggerKeywords: e.target.value
                      .split(/[,，]/)
                      .map((t: string) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="如：复盘, 今日总结"
                className="w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">流程（只读预览）</label>
              <ol className="space-y-1.5">
                {distillPreview.steps.map((s, i) => (
                  <li key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2">
                    {skillStepLabel(s, i)}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
