import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { DashboardCharts } from "@/components/dashboard-charts"
import { startOfDay, endOfDay, toDateString, getWeekStart, getWeekEnd, daysAgo } from "@/lib/date-utils"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const userId = user.id
  const today = startOfDay(new Date())
  const todayEnd = endOfDay(today)
  const todayStr = toDateString(today)

  // ── 本周时间范围 ──
  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()

  // 图表数据范围：近 90 天
  const chartStart = daysAgo(90)
  chartStart.setDate(chartStart.getDate() - 90)
  chartStart.setHours(0, 0, 0, 0)

  // ── 并行查询所有数据（已合并重复查询）──
  const [
    todayTasks,
    taskStats,
    goal,
    recentChecks,
    allCheckIns,
    allTasks,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { userId, date: { gte: today, lte: todayEnd } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.aggregate({
      where: { userId },
      _count: { id: true },
    }),
    prisma.goal.findUnique({ where: { userId } }),
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.checkIn.findMany({
      where: { userId, date: { gte: chartStart } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, duration: true, status: true },
    }),
    prisma.task.findMany({
      where: { userId, date: { gte: chartStart } },
      select: { id: true, title: true, phase: true, completed: true, duration: true },
    }),
  ])

  // 用 allCheckIns 派生本周数据和连续打卡，不再单独查询
  const totalAll = taskStats._count.id
  const completedAll = allTasks.filter(t => t.completed).length

  // ── 派生数据 ──
  const todayCompleted = todayTasks.filter(t => t.completed).length
  const todayTotal = todayTasks.length
  const todayMinutes = todayTasks.reduce((s, t) => s + (t.duration || 0), 0)

  // ── 用 allCheckIns 派生本周和打卡数据（O(n) 单次遍历）──
  const checkinDateSet = new Set<string>()
  const weekDurationMap = new Map<string, number>()
  const weekStartStr = toDateString(weekStart)
  const weekEndStr = toDateString(weekEnd)

  for (const c of allCheckIns) {
    const ds = toDateString(c.date)
    checkinDateSet.add(ds)
    if (ds >= weekStartStr && ds <= weekEndStr) {
      weekDurationMap.set(ds, (weekDurationMap.get(ds) || 0) + c.duration)
    }
  }

  const weekMinutes = Array.from(weekDurationMap.values()).reduce((s, v) => s + v, 0)
  const weekDays = weekDurationMap.size

  // ── 连续打卡天数（Set O(1) 查找）──
  let streak = 0
  const checkDate = new Date(today)
  for (let i = 0; i < 365; i++) {
    if (checkinDateSet.has(toDateString(checkDate))) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else break
  }

  const daysLeft = goal
    ? Math.max(0, Math.ceil((new Date(goal.examDate).getTime() - today.getTime()) / 86400000)) || 0
    : 0

  // ── 本周每日时长（直接从 Map 读取）──
  const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"]
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const ds = toDateString(d)
    return { day: weekDayNames[i], minutes: weekDurationMap.get(ds) || 0, isToday: i === today.getDay() }
  })
  const weekMax = Math.max(...weekBars.map(b => b.minutes), 60)

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 lg:p-6 text-white">
        <h1 className="text-lg lg:text-2xl font-bold">
          {goal ? `欢迎回来！目标：${goal.university} ${goal.major}` : '欢迎回来！'}
        </h1>
        <p className="mt-1 text-sm lg:text-base opacity-90">
          {goal
            ? `距考试还有 ${daysLeft} 天，加油 💪`
            : '先去设置考研目标，AI 为你生成专属计划'}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon="📋" label="今日任务" value={`${todayCompleted}/${todayTotal}`} sub={`${todayMinutes} 分钟`} color="blue" />
        <StatCard icon="⏱️" label="本周学习" value={`${(weekMinutes / 60).toFixed(1)}h`} sub={`打卡 ${weekDays} 天`} color="green" />
        <StatCard icon="🔥" label="连续打卡" value={`${streak} 天`} sub={streak >= 7 ? '太棒了！' : streak >= 3 ? '继续加油' : '从今天开始'} color="orange" />
        <StatCard icon="📊" label="任务完成率" value={`${totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0}%`} sub={`${completedAll}/${totalAll}`} color="purple" />
      </div>

      {/* 本周时长 + 最近打卡 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">本周每日学习时长</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {weekBars.map((bar) => (
              <div key={bar.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{bar.minutes > 0 ? `${Math.round(bar.minutes / 60)}h` : ''}</span>
                <div
                  className={`w-full rounded-t-md transition-all ${bar.isToday ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-800'}`}
                  style={{ height: `${Math.max(4, (bar.minutes / weekMax) * 100)}%` }}
                />
                <span className={`text-xs ${bar.isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>{bar.day}</span>
              </div>
            ))}
          </div>
          {weekDays === 0 && (
            <p className="text-center text-sm text-gray-400 mt-2">这周还没有打卡数据</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-3">最近打卡</h3>
          {recentChecks.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">还没有打卡记录</p>
          ) : (
            <div className="space-y-2">
              {recentChecks.map((check) => (
                <div key={check.id} className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span>{check.status === 'good' ? '😊' : check.status === 'normal' ? '😐' : '😫'}</span>
                    <span className="text-sm">{new Date(check.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
                  </div>
                  <span className="text-sm text-gray-500">{Math.round((check.duration || 0) / 60)} 小时</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 图表区域：热力图 + 统计 */}
      <DashboardCharts
        checkIns={allCheckIns.map(c => ({
          id: c.id, date: c.date.toISOString(), duration: c.duration, status: c.status,
        }))}
        tasks={allTasks.map(t => ({
          id: t.id, title: t.title, phase: t.phase, completed: t.completed, duration: t.duration ?? undefined,
        }))}
      />

      {/* 今日任务列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">今日任务 ({todayStr})</h3>
          <Link href="/tasks" className="text-sm text-blue-500 hover:underline">查看全部 →</Link>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">今天还没有任务</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg ${task.completed ? 'bg-gray-50 dark:bg-gray-700/50 opacity-60' : ''}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {task.completed && <span className="text-white text-xs">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                  {task.duration && <p className="text-xs text-gray-400">{task.duration} 分钟</p>}
                </div>
                {task.phase && <span className="text-xs text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">{task.phase}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { href: '/tasks', icon: '📋', label: '计划' },
          { href: '/checkin', icon: '✅', label: '打卡' },
          { href: '/goal', icon: '🎯', label: '目标' },
          { href: '/materials', icon: '📚', label: '资料' },
          { href: '/chat', icon: '💬', label: 'AI 问答' },
          { href: '/feedback', icon: '📊', label: '反馈' },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center gap-1 p-3 bg-white dark:bg-gray-800 rounded-xl border hover:shadow-md transition-shadow">
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string
  color: 'blue' | 'green' | 'orange' | 'purple'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className={`text-xl p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  )
}
