import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkbenchGrid } from "@/components/workbench/workbench-grid"
import { startOfDay, endOfDay, toDateString, getWeekStart, getWeekEnd, daysAgo } from "@/lib/date-utils"
import { getDueCount } from "@/lib/sm2"

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
    recentChecks: recentChecks.map((c) => ({
      id: c.id,
      date: c.date.toISOString(),
      duration: c.duration,
      status: c.status,
    })),
  }

  return (
    <div className="p-4 lg:p-6">
      <WorkbenchGrid data={workbenchData} />
    </div>
  )
}
