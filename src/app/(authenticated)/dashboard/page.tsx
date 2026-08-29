import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkbenchGrid } from "@/components/workbench/workbench-grid"
import { ChangelogBanner } from "@/components/changelog-banner"
import { OnboardingModal } from "@/components/onboarding-modal"
import { OnboardingCard } from "@/components/onboarding-card"
import { startOfDay, endOfDay, toDateString, getWeekStart, getWeekEnd, daysAgo } from "@/lib/date-utils"
import { getDueCount } from "@/lib/sm2"
import { derivePrepStage } from "@/lib/prep-stage"
import type { SubjectProgress } from "@/lib/completion"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const userId = user.id
  const today = startOfDay(new Date())
  const todayEnd = endOfDay(today)
  const todayStr = toDateString(today)

  // 本周
  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()
  const weekStartStr = toDateString(weekStart)
  const weekEndStr = toDateString(weekEnd)

  // 90 天数据范围
  const chartStart = daysAgo(90)

  // ── 并行查询 ──
  const [
    todayTasks,
    taskStats,
    goal,
    recentChecks,
    allCheckIns,
    allTasks,
    recentMaterials,
    dueWrongQuestions,
    recentWrongQuestions,
  ] = await Promise.all([
    // 今日任务
    prisma.task.findMany({
      where: { userId, date: { gte: today, lte: todayEnd } },
      orderBy: { createdAt: "asc" },
    }),
    // 全部任务计数
    prisma.task.aggregate({
      where: { userId },
      _count: { id: true },
    }),
    // 目标
    prisma.goal.findUnique({ where: { userId } }),
    // 最近打卡（5 条用于显示）
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
    }),
    // 90 天打卡数据
    prisma.checkIn.findMany({
      where: { userId, date: { gte: chartStart } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, duration: true, status: true, note: true },
    }),
    // 90 天任务数据
    prisma.task.findMany({
      where: { userId, date: { gte: chartStart } },
      select: { id: true, title: true, phase: true, completed: true, duration: true },
    }),
    // 最近上传资料
    prisma.material.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, createdAt: true },
    }),
    // 到期需复习的错题
    prisma.wrongQuestion.findMany({
      where: {
        userId,
        reviewed: false,
        nextReviewDate: { lte: endOfDay(new Date()) },
      },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
      select: { id: true, question: true, subject: true, interval: true, nextReviewDate: true },
    }),
    // 最近错题
    prisma.wrongQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, question: true, subject: true, interval: true, nextReviewDate: true },
    }),
  ])

  // ── 派生统计数据 ──

  // 打卡日期集合
  const checkinDateSet = new Set<string>()
  const weekDurationMap = new Map<string, number>()

  for (const c of allCheckIns) {
    const ds = toDateString(c.date)
    checkinDateSet.add(ds)
    if (ds >= weekStartStr && ds <= weekEndStr) {
      weekDurationMap.set(ds, (weekDurationMap.get(ds) || 0) + c.duration)
    }
  }

  const todayCompleted = todayTasks.filter((t) => t.completed).length
  const todayTotal = todayTasks.length
  const todayMinutes = todayTasks.reduce((s, t) => s + (t.duration || 0), 0)

  const weekMinutes = Array.from(weekDurationMap.values()).reduce((s, v) => s + v, 0)
  const weekDays = weekDurationMap.size

  // 连续打卡
  let streak = 0
  const checkDate = new Date(today)
  for (let i = 0; i < 365; i++) {
    if (checkinDateSet.has(toDateString(checkDate))) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else break
  }

  const totalAll = taskStats._count.id
  const completedAll = allTasks.filter((t) => t.completed).length
  const completionRate = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0

  // 距考试天数
  const daysLeft = goal
    ? Math.max(0, Math.ceil((new Date(goal.examDate).getTime() - today.getTime()) / 86400000)) || 0
    : 0

  // 备考阶段（0.3）：探索/基础/备考/冲刺
  const stage = derivePrepStage({
    examDate: goal?.examDate ?? null,
    hasGoal: !!goal,
    subjects: goal?.subjects,
    subjectProgress: (goal?.progress as Record<string, SubjectProgress> | null) || null,
    weeklyHours: (goal?.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null,
  })

  // 本周柱状图
  const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"]
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const ds = toDateString(d)
    return { day: weekDayNames[i], minutes: weekDurationMap.get(ds) || 0, isToday: i === today.getDay() }
  })

  // 到期错题数
  const dueWrongCount = getDueCount(dueWrongQuestions)

  // 今日学了什么（从今日任务 + 打卡提取科目）
  const todaySubjects: string[] = []
  for (const t of todayTasks) {
    if (t.subject && !todaySubjects.includes(t.subject)) {
      todaySubjects.push(t.subject)
    }
  }
  // 也尝试从打卡备注里提取科目关键词
  const todayCheckin = allCheckIns.find((c) => toDateString(c.date) === todayStr)
  if (todayCheckin?.note) {
    const subjectKeywords = goal?.subjects || []
    for (const subj of subjectKeywords) {
      if (todayCheckin.note.includes(subj) && !todaySubjects.includes(subj)) {
        todaySubjects.push(subj)
      }
    }
  }

  // 所有可用科目
  const subjects = goal?.subjects || []

  // ── 重入判断：今日未打卡 + 距上次打卡 > 3 天 → 显示温柔重入卡 ──
  const checkedInToday = Boolean(todayCheckin)
  const lastCheckinDate = recentChecks.find((c) => toDateString(c.date) !== todayStr)?.date ?? null
  const daysSinceLastCheckin = lastCheckinDate
    ? Math.round((today.getTime() - startOfDay(lastCheckinDate).getTime()) / 86400000)
    : null
  const showReentry = !checkedInToday && daysSinceLastCheckin !== null && daysSinceLastCheckin > 3

  // ── 组装 Props ──
  const workbenchData = {
    stats: {
      todayTasks: { completed: todayCompleted, total: todayTotal, minutes: todayMinutes },
      weekStudy: { hours: weekMinutes / 60, days: weekDays },
      streak,
      completionRate: { rate: completionRate, completed: completedAll, total: totalAll },
    },
    todayTasks: todayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      duration: t.duration,
      phase: t.phase,
    })),
    dateStr: todayStr,
    subjects,
    todaySubjects,
    dueWrongCount,
    weekBars,
    materials: recentMaterials.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      createdAt: m.createdAt.toISOString(),
    })),
    wrongQuestions: (dueWrongQuestions.length > 0 ? dueWrongQuestions : recentWrongQuestions).map(
      (w) => ({
        id: w.id,
        question: w.question,
        subject: w.subject,
        interval: w.interval,
        nextReviewDate: w.nextReviewDate?.toISOString() || null,
      })
    ),
    goal: goal ? { university: goal.university, major: goal.major } : null,
    daysLeft,
    reentry: { show: showReentry, daysSinceLastCheckin },
  }

  // 新用户判定：无目标 + 无任务 + 无打卡（用于引导弹窗/卡片）
  const isNewUser = !goal && todayTasks.length === 0 && recentChecks.length === 0

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* ── 新用户引导（首次弹窗 + 常驻卡片）── */}
      <OnboardingModal isNewUser={isNewUser} />
      {isNewUser && <OnboardingCard isNewUser hasGoal={!!goal} />}

      {/* ── 更新告示（有新版本时出现，可关闭）── */}
      <ChangelogBanner />

      {/* ── 今日状态 Banner ── */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand/8 to-brand/3 px-5 py-4 lg:px-6 lg:py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight">学习概览</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                📅 {todayStr} {weekDayNames[today.getDay()]} · {stage.hint}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">今日</span>
                <span className="font-semibold">{todayCompleted}/{todayTotal}</span>
                <span className="text-muted-foreground text-xs">任务</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{weekDays}/7</span>
                <span className="text-muted-foreground text-xs">天打卡</span>
              </div>
              <div className="w-px h-5 bg-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-muted-foreground">🔥</span>
                <span className="font-semibold">{streak}</span>
                <span className="text-muted-foreground text-xs">天连续</span>
              </div>
            </div>
          </div>
        </div>

        {/* 快速操作栏 */}
        <div className="px-5 py-3 lg:px-6 border-t border-border/30 bg-muted/30">
          <div className="flex items-center gap-2 overflow-x-auto">
            <a
              href="/chat"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors active:scale-[0.97]"
            >
              <span>🤖</span>
              <span>AI 助手</span>
            </a>
            <a
              href="/checkin"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>✅</span>
              <span>打卡</span>
            </a>
            <a
              href="/pomodoro"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>🍅</span>
              <span>专注</span>
            </a>
            <a
              href="/practice"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>✏️</span>
              <span>练习</span>
            </a>
            {dueWrongCount > 0 && (
              <a
                href="/wrong-questions?dueToday=true"
                className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-warning/10 hover:bg-warning/20 text-warning text-sm font-medium transition-colors active:scale-[0.97]"
              >
                <span>📕</span>
                <span>{dueWrongCount} 题待复习</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <WorkbenchGrid data={workbenchData} />
    </div>
  )
}
