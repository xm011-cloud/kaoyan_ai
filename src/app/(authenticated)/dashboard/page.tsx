import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkbenchGrid } from "@/components/workbench/workbench-grid"
import { TodayCommandCenter } from "@/components/workbench/today-command-center"
import { ChangelogBanner } from "@/components/changelog-banner"
import { OnboardingModal } from "@/components/onboarding-modal"
import { OnboardingCard } from "@/components/onboarding-card"
import { addStudyDays, daysAgo, getStudyWeekRange, studyDateToUtc, toDateString, toStudyDateString } from "@/lib/date-utils"
import { getDueCount } from "@/lib/sm2"
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
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      query,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`查询超过 ${DASHBOARD_QUERY_TIMEOUT_MS / 1000} 秒`)), DASHBOARD_QUERY_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("查询超过")) {
      // 同一请求会并行降级多项统计；只记录一次，避免网络波动淹没服务端日志。
      if (Date.now() - lastDashboardTimeoutLogAt > 60_000) {
        lastDashboardTimeoutLogAt = Date.now()
        console.warn("[dashboard] 数据库响应较慢，概览页已降级展示可操作内容")
      }
      return fallback
    }
    console.error(`[dashboard] ${label} 加载失败，已降级为空数据`, error)
    return fallback
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

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
  // “今天”按用户的学习日历（当前为北京时间）而非 Vercel 的 UTC 进程时区计算。
  const todayStr = toStudyDateString(new Date())
  const today = studyDateToUtc(todayStr)
  const todayEnd = new Date(studyDateToUtc(addStudyDays(todayStr, 1)).getTime() - 1)

  // 本周
  const { start: weekStartStr, end: weekEndStr } = getStudyWeekRange()
  const weekStart = studyDateToUtc(weekStartStr)
  const planningWeekStartStr = weekStartStr

  // 90 天数据范围
  const chartStart = daysAgo(90)

  // ── 并行查询 ──
  const [
    todayTasks,
    taskStats,
    goal,
    formalStage,
    currentMilestone,
    weeklyPlans,
    recentChecks,
    allCheckIns,
    allTasks,
    recentMaterials,
    dueWrongQuestions,
    continueLessons,
    recentWrongQuestions,
  ] = await Promise.all([
    // 今日任务
    recoverDashboardQuery("今日任务", prisma.task.findMany({
      where: { userId, date: { gte: today, lte: todayEnd } },
      orderBy: { createdAt: "asc" },
      include: {
        milestone: {
          select: { id: true, title: true, subject: true, createdAt: true, progress: true, completedAt: true },
        },
      },
    }), []),
    // 全部任务计数
    recoverDashboardQuery("任务统计", prisma.task.aggregate({
      where: { userId },
      _count: { id: true },
    }), { _count: { id: 0 } }),
    // 目标
    recoverDashboardQuery("考研目标", prisma.goal.findUnique({ where: { userId } }), null),
    // 正式长期路线的当前阶段（存在时优先于算法建议）
    recoverDashboardQuery("当前阶段", prisma.studyPathStage.findFirst({
      where: { studyPath: { userId, status: "active" }, status: "active" },
      orderBy: { order: "asc" },
    }), null),
    recoverDashboardQuery("当前里程碑", prisma.studyPathMilestone.findFirst({
      where: { studyPath: { userId, status: "active" }, stage: { status: "active" }, completedAt: null },
      orderBy: { order: "asc" },
    }), null),
    // 当前自然周的周计划版本：草稿优先展示，提醒用户确认；否则展示活动版本。
    recoverDashboardQuery("本周计划", prisma.weeklyPlan.findMany({
      where: {
        userId,
        weekStart: new Date(planningWeekStartStr),
        status: { in: ["draft", "active"] },
      },
      orderBy: { version: "desc" },
      select: { id: true, status: true, objective: true, plannedMinutes: true, weekStart: true },
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
    // 90 天任务数据
    recoverDashboardQuery("任务趋势", prisma.task.findMany({
      where: { userId, date: { gte: chartStart } },
      select: { id: true, title: true, phase: true, completed: true, duration: true },
    }), []),
    // 最近上传资料
    recoverDashboardQuery("最近资料", prisma.material.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, createdAt: true },
    }), []),
    // 到期需复习的错题
    recoverDashboardQuery("到期错题", prisma.wrongQuestion.findMany({
      where: {
        userId,
        reviewed: false,
        nextReviewDate: { lte: todayEnd },
      },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
      select: { id: true, question: true, subject: true, interval: true, nextReviewDate: true },
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
        weekStart: planningWeekStartStr,
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      {/* ── 新用户引导（首次弹窗 + 常驻卡片；?tour=1 强制重放）── */}
      <OnboardingModal isNewUser={isNewUser} forceTour={forceTour} />
      {(isNewUser || forceTour) && <OnboardingCard isNewUser hasGoal={!!goal} forceTour={forceTour} />}

      {/* ── 更新告示（有新版本时出现，可关闭）── */}
      <ChangelogBanner />

      <TodayCommandCenter
        dateLabel={`今天 · ${todayStr} 星期${weekDayNames[today.getDay()]}`}
        goalLabel={goal ? getGoalLabel(goal) : null}
        stageLabel={goal ? formalStage?.title ?? stage.label : '从今天开始建立学习节奏'}
        stageHint={goal ? stageHint : '先确定一个方向，AI 再帮你把它切成阶段和行动。'}
        daysLeft={goalDaysLeft}
        weeklyPlan={workbenchData.planning.weeklyPlan}
        today={{ completed: todayCompleted, total: todayTotal, nextTask: nextTodayTask ? { id: nextTodayTask.id, title: nextTodayTask.title, courseLessonId: nextTodayTask.courseLessonId } : null, minutes: todayMinutes }}
        dueWrongCount={dueWrongCount}
      />

      <WorkbenchGrid data={workbenchData} isExploration={!goal || goal.status === "exploring"} />
    </div>
  )
}
