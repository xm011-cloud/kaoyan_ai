import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkbenchGrid } from "@/components/workbench/workbench-grid"
import { ChangelogBanner } from "@/components/changelog-banner"
import { OnboardingModal } from "@/components/onboarding-modal"
import { OnboardingCard } from "@/components/onboarding-card"
import { startOfDay, endOfDay, toDateString, toLocalDateString, getWeekStart, getWeekEnd, daysAgo } from "@/lib/date-utils"
import { getDueCount } from "@/lib/sm2"
import { derivePrepStage } from "@/lib/prep-stage"
import type { SubjectProgress } from "@/lib/completion"
import { getDaysToGoal, getGoalLabel } from "@/lib/goal-model"

// 每次请求服务端渲染，避免客户端软导航时命中 RSC 缓存显示旧任务状态（勾选后 dashboard 需实时同步）
export const dynamic = "force-dynamic"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string }>
}) {
  const sp = await searchParams
  // ?tour=1：无条件重放新用户引导（测试 / 「重新查看引导」入口）
  const forceTour = sp.tour === "1"

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
  const planningWeekStartStr = toLocalDateString(weekStart)

  // 90 天数据范围
  const chartStart = daysAgo(90)

  // ── 并行查询 ──
  const [
    todayTasks,
    taskStats,
    goal,
    formalStage,
    weeklyPlans,
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
    // 正式长期路线的当前阶段（存在时优先于算法建议）
    prisma.studyPathStage.findFirst({
      where: { studyPath: { userId, status: "active" }, status: "active" },
      orderBy: { order: "asc" },
    }),
    // 当前自然周的周计划版本：草稿优先展示，提醒用户确认；否则展示活动版本。
    prisma.weeklyPlan.findMany({
      where: {
        userId,
        weekStart: new Date(planningWeekStartStr),
        status: { in: ["draft", "active"] },
      },
      orderBy: { version: "desc" },
      select: { id: true, status: true, objective: true, plannedMinutes: true, weekStart: true },
    }),
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
  const goalDaysLeft = goal ? getDaysToGoal(goal, today) : null
  const daysLeft = goalDaysLeft ?? 0

  // 备考阶段（0.3）：探索/基础/备考/冲刺
  const stage = derivePrepStage({
    examDate: goal?.examDate ?? null,
    hasGoal: !!goal,
    subjects: goal?.subjects,
    subjectProgress: (goal?.progress as Record<string, SubjectProgress> | null) || null,
    weeklyHours: (goal?.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null,
  })
  const stageHint = formalStage
    ? `当前阶段：${formalStage.title} · ${formalStage.objective}`
    : stage.hint

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
  const projectedWeeklyPlan = weeklyPlans.find((plan) => plan.status === "draft")
    ?? weeklyPlans.find((plan) => plan.status === "active")
    ?? null

  // ── 重入判断：今日未打卡 + 距上次打卡 > 3 天 → 显示温柔重入卡 ──
  const checkedInToday = Boolean(todayCheckin)
  const lastCheckinDate = recentChecks.find((c) => toDateString(c.date) !== todayStr)?.date ?? null
  const daysSinceLastCheckin = lastCheckinDate
    ? Math.round((today.getTime() - startOfDay(lastCheckinDate).getTime()) / 86400000)
    : null
  const showReentry = !checkedInToday && daysSinceLastCheckin !== null && daysSinceLastCheckin > 3

  // ── 组装 Props ──
  const workbenchData = {
    planning: {
      goal: goal ? { label: getGoalLabel(goal), status: goal.status } : null,
      stage: formalStage ? {
        title: formalStage.title,
        objective: formalStage.objective,
        exitCriteriaCount: Array.isArray(formalStage.exitCriteria) ? formalStage.exitCriteria.length : 0,
      } : null,
      weeklyPlan: projectedWeeklyPlan ? {
        status: projectedWeeklyPlan.status as "draft" | "active",
        objective: projectedWeeklyPlan.objective,
        plannedMinutes: projectedWeeklyPlan.plannedMinutes,
        weekStart: planningWeekStartStr,
      } : {
        status: "none" as const,
        objective: null,
        plannedMinutes: 0,
        weekStart: planningWeekStartStr,
      },
      today: {
        completed: todayCompleted,
        total: todayTotal,
        nextTask: todayTasks.find((task) => !task.completed)?.title ?? null,
      },
    },
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
    goal: goal ? { label: getGoalLabel(goal), status: goal.status } : null,
    daysLeft,
    reentry: { show: showReentry, daysSinceLastCheckin },
  }

  // 新用户判定：无目标 + 无任务 + 无打卡（用于引导弹窗/卡片）
  const isNewUser = !goal && todayTasks.length === 0 && recentChecks.length === 0

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      {/* ── 新用户引导（首次弹窗 + 常驻卡片；?tour=1 强制重放）── */}
      <OnboardingModal isNewUser={isNewUser} forceTour={forceTour} />
      {(isNewUser || forceTour) && <OnboardingCard isNewUser hasGoal={!!goal} forceTour={forceTour} />}

      {/* ── 更新告示（有新版本时出现，可关闭）── */}
      <ChangelogBanner />

      {/* ── 今日状态 Hero（渐变身份头：标题 → 目标/欢迎 → 阶段 → 数据 → 快速操作）── */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-primary/80 text-white shadow-lg shadow-brand/20 overflow-hidden">
        <div className="px-5 py-5 lg:px-6 lg:py-6">
          <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">学习概览</h1>
            <span className="text-xs text-white/60">📅 {todayStr} {weekDayNames[today.getDay()]}</span>
          </div>

          {/* 身份锚点 / 欢迎语（Hero 的灵魂：大字目标或欢迎） */}
          {goal ? (
            <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
              <p className="text-lg lg:text-xl font-semibold tracking-tight">
                🎯 {getGoalLabel(goal)}
              </p>
              {goalDaysLeft == null ? (
                <a href="/goal" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-sm font-medium hover:bg-white/25">
                  完善目标 →
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-sm font-bold tabular-nums">
                  ⏳ 距考试 {daysLeft} 天
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-lg lg:text-xl font-semibold tracking-tight">🎓 欢迎来到考研助手</p>
              <p className="mt-1 text-sm text-white/70">设个目标，AI 帮你生成专属备考计划</p>
              <a
                href="/goal"
                className="inline-block mt-3 px-4 py-2 rounded-full bg-white text-brand text-sm font-semibold hover:bg-white/90 transition-colors active:scale-[0.97]"
              >
                🎯 去设置目标 →
              </a>
            </div>
          )}

          {/* 阶段提示 */}
          <p className="mt-2 text-xs text-white/60">{stageHint}</p>

          {/* 内联统计（今日任务 / 打卡 / 连续） */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-white/60">今日</span>
              <span className="font-bold tabular-nums">{todayCompleted}/{todayTotal}</span>
              <span className="text-white/60 text-xs">任务</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="text-white/60">{weekDays}/7</span>
              <span className="text-white/60 text-xs">天打卡</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span>🔥</span>
              <span className="font-bold tabular-nums">{streak}</span>
              <span className="text-white/60 text-xs">天连续</span>
            </div>
          </div>
        </div>

        {/* 快速操作栏 */}
        <div className="px-5 py-3 lg:px-6 border-t border-white/15 bg-white/5">
          <div className="flex items-center gap-2 overflow-x-auto">
            <a
              href="/chat"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-white text-brand text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              <span>🤖</span>
              <span>AI 助手</span>
            </a>
            <a
              href="/checkin"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>✅</span>
              <span>打卡</span>
            </a>
            <a
              href="/pomodoro"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>🍅</span>
              <span>专注</span>
            </a>
            <a
              href="/practice"
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors active:scale-[0.97]"
            >
              <span>✏️</span>
              <span>练习</span>
            </a>
            {dueWrongCount > 0 && (
              <a
                href="/wrong-questions?dueToday=true"
                className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-amber-400/90 text-amber-950 text-sm font-medium hover:bg-amber-400 transition-colors active:scale-[0.97]"
              >
                <span>📕</span>
                <span>{dueWrongCount} 题待复习</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <WorkbenchGrid data={workbenchData} isExploration={!goal || goal.status === "exploring"} />
    </div>
  )
}
