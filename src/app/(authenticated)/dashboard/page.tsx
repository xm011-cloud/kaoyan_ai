import { getServerAuthUser } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { WorkbenchGrid } from "@/components/workbench/workbench-grid"
import { TodayCommandCenter } from "@/components/workbench/today-command-center"
import { ChangelogBanner } from "@/components/changelog-banner"
import { OnboardingModal } from "@/components/onboarding-modal"
import { OnboardingCard } from "@/components/onboarding-card"
import { addStudyDays, daysAgo, getStudyWeekRange, studyDateToUtc, toDateString, toStudyDateString } from "@/lib/date-utils"
import { derivePrepStage } from "@/lib/prep-stage"
import type { SubjectProgress } from "@/lib/completion"
import { getDaysToGoal, getGoalLabel } from "@/lib/goal-model"
import { getMilestoneEvidence } from "@/lib/milestone-evidence"

// 每次请求服务端渲染，避免客户端软导航时命中 RSC 缓存显示旧任务状态（勾选后 dashboard 需实时同步）
export const dynamic = "force-dynamic"

const DASHBOARD_QUERY_TIMEOUT_MS = 5_000
let lastDashboardTimeoutLogAt = 0

/**
 * 概览页的统计和推荐都属于可恢复信息：数据库偶发冷启动时，不能因为一项辅助查询
 * 让整个学习工作台掉进错误页。核心认证失败仍由上层正常处理。
 */
async function recoverDashboardQuery<T>(label: string, query: Promise<T>, fallback: T): Promise<T> {
  return (await recoverDashboardQueryWithStatus(label, query, fallback)).value
}

/**
 * 行动主线上的数据不能把“暂时读不到”伪装成“没有”。保留降级标记，交给界面
 * 明确提示重试；辅助统计仍可直接使用 recoverDashboardQuery 的空值兜底。
 */
async function recoverDashboardQueryWithStatus<T>(label: string, query: Promise<T>, fallback: T): Promise<{ value: T; degraded: boolean }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return { value: await Promise.race([
      query,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`查询超过 ${DASHBOARD_QUERY_TIMEOUT_MS / 1000} 秒`)), DASHBOARD_QUERY_TIMEOUT_MS)
      }),
    ]), degraded: false }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("查询超过")) {
      // 同一请求会并行降级多项统计；只记录一次，避免网络波动淹没服务端日志。
      if (Date.now() - lastDashboardTimeoutLogAt > 60_000) {
        lastDashboardTimeoutLogAt = Date.now()
        console.warn("[dashboard] 数据库响应较慢，概览页已降级展示可操作内容")
      }
      return { value: fallback, degraded: true }
    }
    console.error(`[dashboard] ${label} 加载失败，已降级为空数据`, error)
    return { value: fallback, degraded: true }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function getDashboardDateContext() {
  // “今天”按用户的学习日历（当前为北京时间）而非 Vercel 的 UTC 进程时区计算。
  const todayStr = toStudyDateString(new Date())
  const today = studyDateToUtc(todayStr)
  const todayEnd = new Date(studyDateToUtc(addStudyDays(todayStr, 1)).getTime() - 1)
  const { start: weekStartStr, end: weekEndStr } = getStudyWeekRange()
  const weekStart = studyDateToUtc(weekStartStr)
  const chartStart = daysAgo(90)
  return { todayStr, today, todayEnd, weekStartStr, weekEndStr, weekStart, chartStart }
}

type DashboardDateContext = ReturnType<typeof getDashboardDateContext>

/** 先加载用户必须立刻看到的行动主线，避免辅助卡片拖住“现在做什么”。 */
function loadDashboardPrimary(userId: string, context: DashboardDateContext) {
  const { today, todayEnd, weekStartStr } = context
  return Promise.all([
    recoverDashboardQueryWithStatus("今日任务", prisma.task.findMany({
      where: { userId, date: { gte: today, lte: todayEnd } },
      orderBy: { createdAt: "asc" },
      include: { milestone: { select: { id: true, title: true, subject: true, createdAt: true, progress: true, completedAt: true } } },
    }), []),
    recoverDashboardQueryWithStatus("考研目标", prisma.goal.findUnique({ where: { userId } }), null),
    recoverDashboardQuery("本周计划", prisma.weeklyPlan.findMany({
      // 常规计划按自然周读取；首周探索允许用户从任意一天开始，因此额外读取覆盖今天的活动探索周。
      where: { userId, status: { in: ["draft", "active"] }, OR: [
        { weekStart: new Date(weekStartStr) },
        { studyPath: { title: { startsWith: "首周探索：" } }, weekStart: { lte: today }, weekEnd: { gte: today } },
      ] },
      orderBy: { version: "desc" },
      select: { id: true, status: true, objective: true, plannedMinutes: true, weekStart: true },
    }), []),
  ])
}

type DashboardPrimary = Awaited<ReturnType<typeof loadDashboardPrimary>>

/**
 * 只有今天没有待办、或已完成所有待办时，复习才有资格成为主行动。延后到这个分支
 * 再查，保证正常学习日不会被辅助计数查询拖慢首屏。
 */
function loadDashboardReviewCounts(userId: string, todayEnd: Date) {
  return Promise.all([
    recoverDashboardQueryWithStatus("到期错题数", prisma.wrongQuestion.count({
      where: { userId, nextReviewDate: { lte: todayEnd } },
    }), 0),
    recoverDashboardQueryWithStatus("到期理解记录数", prisma.studyNote.count({
      where: { userId, nextReviewAt: { lte: todayEnd } },
    }), 0),
  ])
}

async function DashboardHero({ primary, context, userId }: { primary: Promise<DashboardPrimary>; context: DashboardDateContext; userId: string }) {
  const [todayTaskQuery, goalQuery, weeklyPlans] = await primary
  const todayTasks = todayTaskQuery.value
  const goal = goalQuery.value
  const { todayStr, today, weekStartStr } = context
  const stage = derivePrepStage({
    examDate: goal?.examDate ?? null,
    hasGoal: !!goal,
    subjects: goal?.subjects,
    subjectProgress: (goal?.progress as Record<string, SubjectProgress> | null) || null,
    weeklyHours: (goal?.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null,
  })
  const stageHint = stage.hint
  const activeWeeklyPlan = weeklyPlans.find((plan) => plan.status === "active") ?? null
  const draftWeeklyPlan = weeklyPlans.find((plan) => plan.status === "draft") ?? null
  const projectedWeeklyPlan = activeWeeklyPlan ?? draftWeeklyPlan ?? null
  const nextTodayTask = todayTasks.find((task) => !task.completed) ?? null
  const needsReviewAction = !todayTaskQuery.degraded && nextTodayTask === null
  const [dueWrongQuery, dueUnderstandingQuery] = needsReviewAction
    ? await loadDashboardReviewCounts(userId, context.todayEnd)
    : [{ value: 0, degraded: false }, { value: 0, degraded: false }]
  const focusMilestone = nextTodayTask?.milestone ?? null
  const todayCompleted = todayTasks.filter((task) => task.completed).length
  const todayMinutes = todayTasks.reduce((total, task) => total + (task.duration || 0), 0)
  const weeklyPlan = projectedWeeklyPlan ? {
    status: projectedWeeklyPlan.status as "draft" | "active",
    objective: projectedWeeklyPlan.objective,
    plannedMinutes: projectedWeeklyPlan.plannedMinutes,
    weekStart: toDateString(projectedWeeklyPlan.weekStart),
    hasDraft: Boolean(draftWeeklyPlan),
    milestoneId: focusMilestone?.id ?? null,
    milestoneTitle: focusMilestone?.title ?? null,
    // 证据摘要延后读取，避免它阻塞“今天做什么”；读取完成后会在工作台上方提示复盘。
    milestoneReviewReady: false,
  } : {
    status: "none" as const, objective: null, plannedMinutes: 0, weekStart: weekStartStr,
    hasDraft: false, milestoneId: focusMilestone?.id ?? null, milestoneTitle: focusMilestone?.title ?? null, milestoneReviewReady: false,
  }
  const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"]

  return <TodayCommandCenter
    dateLabel={`今天 · ${todayStr} 星期${weekDayNames[today.getDay()]}`}
    goalLabel={goal ? getGoalLabel(goal) : null}
    stageLabel={goal ? stage.label : "从今天开始建立学习节奏"}
    stageHint={goal ? stageHint : "先用三个信息开始首周探索：方向、当前最需要补的一科、每周可投入时间。正式路线会等真实学习记录出现后再一起设计。"}
    daysLeft={goal ? getDaysToGoal(goal, today) : null}
    weeklyPlan={weeklyPlan}
    today={{ completed: todayCompleted, total: todayTasks.length, nextTask: nextTodayTask ? { id: nextTodayTask.id, title: nextTodayTask.title, courseLessonId: nextTodayTask.courseLessonId } : null, minutes: todayMinutes, unavailable: todayTaskQuery.degraded }}
    dueWrongCount={dueWrongQuery.value}
    dueUnderstandingCount={dueUnderstandingQuery.value}
    reviewsUnavailable={dueWrongQuery.degraded || dueUnderstandingQuery.degraded}
    starterEligible={!goal && !todayTaskQuery.degraded && !projectedWeeklyPlan && todayTasks.length === 0}
  />
}

function DashboardHeroSkeleton() {
  return <section className="h-[320px] animate-pulse rounded-[28px] border border-border/60 bg-card p-6"><div className="h-3 w-32 rounded bg-muted" /><div className="mt-6 h-8 w-56 rounded bg-muted" /><div className="mt-3 h-4 max-w-xl rounded bg-muted" /><div className="mt-10 h-24 rounded bg-muted/70" /></section>
}

function DashboardDetailsSkeleton() {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="正在加载学习工作台"><div className="h-44 animate-pulse rounded-2xl bg-muted/60" /><div className="h-44 animate-pulse rounded-2xl bg-muted/60" /></div>
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tour?: string; ai?: string }> }) {
  const user = await getServerAuthUser()
  if (!user) redirect("/login")
  const params = await searchParams
  const context = getDashboardDateContext()
  // 新账号首次落到首页时，任务查询可能在服务繁忙时降级。用认证侧的创建时间
  // 保留首次引导资格，避免把“暂时读不到任务”误判成“不是新用户”。
  const isFreshAccount = toStudyDateString(new Date(user.created_at)) === context.todayStr
  const forceTour = params.tour === "1"
  // /chat 会兼容跳转到此页并自动展开 AI 工作区。主动进入对话时，迟到的
  // 新手弹窗不能盖住输入、等待状态或取消按钮；显式 tour 仍应优先展示。
  const suppressOnboardingModal = params.ai === "1" && !forceTour
  const primary = loadDashboardPrimary(user.id, context)

  return <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
    <ChangelogBanner />
    <Suspense fallback={<DashboardHeroSkeleton />}><DashboardHero primary={primary} context={context} userId={user.id} /></Suspense>
    <Suspense fallback={<DashboardDetailsSkeleton />}><DashboardDetails primary={primary} context={context} userId={user.id} forceTour={forceTour} suppressOnboardingModal={suppressOnboardingModal} isFreshAccount={isFreshAccount} /></Suspense>
  </div>
}

async function DashboardDetails({ primary, context, userId, forceTour, suppressOnboardingModal, isFreshAccount }: { primary: Promise<DashboardPrimary>; context: DashboardDateContext; userId: string; forceTour: boolean; suppressOnboardingModal: boolean; isFreshAccount: boolean }) {
  const { todayStr, today, todayEnd, weekStartStr, weekEndStr, weekStart, chartStart } = context
  const planningWeekStartStr = weekStartStr
  const [todayTaskQuery, goalQuery, weeklyPlans] = await primary
  const todayTasks = todayTaskQuery.value
  const goal = goalQuery.value

  // 非关键统计在行动主线已呈现后再读取；低速数据库不再阻塞“今天做什么”。
  const [
    formalStage,
    currentMilestone,
    dueWrongQuestions,
    dueUnderstandingNotes,
    dueWrongCountFromDb,
    dueUnderstandingCountFromDb,
    taskStats,
    recentChecks,
    allCheckIns,
    recentMaterials,
    continueLessons,
    recentWrongQuestions,
  ] = await Promise.all([
    recoverDashboardQuery("当前阶段", prisma.studyPathStage.findFirst({
      where: { studyPath: { userId, status: "active" }, status: "active" }, orderBy: { order: "asc" },
    }), null),
    recoverDashboardQuery("当前里程碑", prisma.studyPathMilestone.findFirst({
      where: { studyPath: { userId, status: "active" }, stage: { status: "active" }, completedAt: null }, orderBy: { order: "asc" },
    }), null),
    recoverDashboardQuery("到期错题", prisma.wrongQuestion.findMany({
      where: { userId, nextReviewDate: { lte: todayEnd } },
      orderBy: { nextReviewDate: "asc" }, take: 10,
      select: { id: true, question: true, subject: true, interval: true, nextReviewDate: true },
    }), []),
    recoverDashboardQuery("到期理解卡", prisma.studyNote.findMany({
      where: { userId, nextReviewAt: { lte: todayEnd } }, orderBy: { nextReviewAt: "asc" }, take: 10, select: { id: true },
    }), []),
    // 工作台列表最多显示 10 条，提示数字仍必须是精确总数；否则积累较多
    // 错题的用户会被错误告知“只有 10 题到期”。这些是非关键统计，不阻塞顶部主行动。
    recoverDashboardQuery("到期错题总数", prisma.wrongQuestion.count({
      where: { userId, nextReviewDate: { lte: todayEnd } },
    }), 0),
    recoverDashboardQuery("到期理解记录总数", prisma.studyNote.count({
      where: { userId, nextReviewAt: { lte: todayEnd } },
    }), 0),
    // 首页只需要完成率，按状态聚合而非读回全部任务，避免任务积累后拖慢首屏。
    recoverDashboardQuery("任务统计", prisma.task.groupBy({
      by: ["completed"],
      where: { userId },
      _count: { id: true },
    }), []),
    // 最近打卡（5 条用于显示）
    recoverDashboardQuery("最近打卡", prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
    }), []),
    // 90 天打卡数据
    recoverDashboardQuery("打卡趋势", prisma.checkIn.findMany({
      where: { userId, date: { gte: chartStart } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, duration: true, status: true, note: true },
    }), []),
    // 最近上传资料
    recoverDashboardQuery("最近资料", prisma.material.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, createdAt: true },
    }), []),
    // 课程工作台只取少量“下一节可行动”的课时，避免首页变成整套课程目录。
    recoverDashboardQuery("继续学习课时", prisma.courseLesson.findMany({
      where: {
        status: { in: ['in_progress', 'not_started'] },
        unit: { course: { userId } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 3,
      select: {
        id: true,
        title: true,
        status: true,
        unit: {
          select: {
            title: true,
            course: { select: { title: true } },
          },
        },
        _count: { select: { notes: true } },
      },
    }), []),
    // 最近错题
    recoverDashboardQuery("最近错题", prisma.wrongQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, question: true, subject: true, interval: true, nextReviewDate: true },
    }), []),
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

  const totalAll = taskStats.reduce((total, group) => total + group._count.id, 0)
  const completedAll = taskStats.find((group) => group.completed)?._count.id ?? 0
  const completionRate = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0

  // 距考试天数
  const goalDaysLeft = goal ? getDaysToGoal(goal, today) : null
  const daysLeft = goalDaysLeft ?? 0

  // 本周柱状图
  const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"]
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const ds = toDateString(d)
    return { day: weekDayNames[i], minutes: weekDurationMap.get(ds) || 0, isToday: i === today.getDay() }
  })

  // 列表受 10 条上限保护，数字取数据库精确计数；若计数查询短暂降级，至少不低于
  // 已成功读出的列表长度，避免把“有待复习”伪装成 0。
  const dueWrongCount = Math.max(dueWrongCountFromDb, dueWrongQuestions.length)
  const dueUnderstandingCount = Math.max(dueUnderstandingCountFromDb, dueUnderstandingNotes.length)

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
  const activeWeeklyPlan = weeklyPlans.find((plan) => plan.status === "active") ?? null
  const draftWeeklyPlan = weeklyPlans.find((plan) => plan.status === "draft") ?? null
  // 今日任务来自已生效版本，因此主叙事也必须优先使用已生效周目标；草稿只作为待确认提醒。
  const projectedWeeklyPlan = activeWeeklyPlan
    ?? draftWeeklyPlan
    ?? null
  const nextTodayTask = todayTasks.find((task) => !task.completed) ?? null
  // 有今日任务时只展示它的真实归属；未归属任务不能用路线默认里程碑冒充。
  const focusMilestone = nextTodayTask ? nextTodayTask.milestone : currentMilestone
  const currentMilestoneEvidence = focusMilestone
    ? await recoverDashboardQuery("里程碑证据", getMilestoneEvidence(userId, focusMilestone), null)
    : null

  // ── 重入判断：今日未打卡 + 距上次打卡 > 3 天 → 显示温柔重入卡 ──
  const checkedInToday = Boolean(todayCheckin)
  const lastCheckinDate = recentChecks.find((c) => toDateString(c.date) !== todayStr)?.date ?? null
  const daysSinceLastCheckin = lastCheckinDate
    ? Math.round((today.getTime() - studyDateToUtc(toDateString(lastCheckinDate)).getTime()) / 86400000)
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
        weekStart: toDateString(projectedWeeklyPlan.weekStart),
        hasDraft: Boolean(draftWeeklyPlan),
        milestoneId: focusMilestone?.id ?? null,
        milestoneTitle: focusMilestone?.title ?? null,
        milestoneReviewReady: currentMilestoneEvidence?.reviewReady ?? false,
      } : {
        status: "none" as const,
        objective: null,
        plannedMinutes: 0,
        weekStart: planningWeekStartStr,
        hasDraft: false,
        milestoneId: focusMilestone?.id ?? null,
        milestoneTitle: focusMilestone?.title ?? null,
        milestoneReviewReady: currentMilestoneEvidence?.reviewReady ?? false,
      },
      today: {
        completed: todayCompleted,
        total: todayTotal,
        nextTask: nextTodayTask?.title ?? null,
      },
    },
    stats: {
      todayTasks: { completed: todayCompleted, total: todayTotal, minutes: todayMinutes, unavailable: todayTaskQuery.degraded },
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
      courseLessonId: t.courseLessonId,
    })),
    todayTasksUnavailable: todayTaskQuery.degraded,
    continueLearning: continueLessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      courseTitle: lesson.unit.course.title,
      unitTitle: lesson.unit.title,
      noteCount: lesson._count.notes,
    })),
    dateStr: todayStr,
    subjects,
    todaySubjects,
    dueWrongCount,
    dueUnderstandingCount,
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

  // 新用户判定：无目标、无学习记录、无任务。仅新注册账户可在“今日任务”
  // 查询临时降级时保留引导，避免既有用户因一次超时重复看到 onboarding。
  const hasNoLearningHistory = !goal && !goalQuery.degraded && recentChecks.length === 0
  const hasNoTodayTasks = !todayTaskQuery.degraded && todayTasks.length === 0
  const isNewUser = hasNoLearningHistory && (hasNoTodayTasks || (todayTaskQuery.degraded && isFreshAccount))

  return <>
    {/* ── 新用户引导（首次弹窗 + 常驻卡片；?tour=1 强制重放）── */}
    <OnboardingModal isNewUser={isNewUser && !suppressOnboardingModal} forceTour={forceTour} />
    {(isNewUser || forceTour) && <OnboardingCard isNewUser hasGoal={!!goal} forceTour={forceTour} />}
    {currentMilestoneEvidence?.reviewReady && focusMilestone && (
      <Link
        href={`/study-path?review=${focusMilestone.id}`}
        className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-success/25 bg-success/5 px-4 py-3 text-sm text-success transition-colors hover:bg-success/10"
      >
        <span><span className="font-medium">「{focusMilestone.title}」已积累足够证据</span><span className="ml-2 text-muted-foreground">现在可以复盘确认，而不是由系统替你宣布完成。</span></span>
        <span className="shrink-0 font-medium">去复盘 →</span>
      </Link>
    )}
    <WorkbenchGrid data={workbenchData} isExploration={(!goal && !goalQuery.degraded) || goal?.status === "exploring"} />
  </>
}
