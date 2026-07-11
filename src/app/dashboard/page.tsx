import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">AI 考研助手</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="outline" size="sm">退出</Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* 欢迎信息 */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold">欢迎回来！</h2>
            <p className="mt-2 opacity-90">今天也要加油学习哦 💪</p>
          </div>

          {/* 功能卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/goal" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold">我的目标</h3>
                <p className="text-sm text-gray-500 mt-1">设置目标院校和考试信息</p>
              </div>
            </Link>

            <Link href="/tasks" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">📋</div>
                <h3 className="text-lg font-semibold">今日任务</h3>
                <p className="text-sm text-gray-500 mt-1">查看今天的学习计划</p>
              </div>
            </Link>

            <Link href="/checkin" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">✅</div>
                <h3 className="text-lg font-semibold">每日打卡</h3>
                <p className="text-sm text-gray-500 mt-1">记录今天的学习情况</p>
              </div>
            </Link>

            <Link href="/materials" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">📚</div>
                <h3 className="text-lg font-semibold">学习资料</h3>
                <p className="text-sm text-gray-500 mt-1">上传和管理学习资料</p>
              </div>
            </Link>

            <Link href="/chat" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">💬</div>
                <h3 className="text-lg font-semibold">AI 问答</h3>
                <p className="text-sm text-gray-500 mt-1">基于资料的智能问答</p>
              </div>
            </Link>

            <Link href="/feedback" className="block">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="text-lg font-semibold">学习反馈</h3>
                <p className="text-sm text-gray-500 mt-1">查看每周学习建议</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
