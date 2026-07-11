import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      <main className="flex flex-1 w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        {/* Logo / 标题 */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            AI 考研助手
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            智能制定学习计划 · 资料上传问答 · 每日打卡追踪 · 学习反馈建议
          </p>
        </div>

        {/* 核心功能介绍 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-3xl">
          <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold">目标规划</h3>
            <p className="text-sm text-gray-500">设定目标，AI 生成计划</p>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border">
            <div className="text-2xl mb-2">📚</div>
            <h3 className="font-semibold">资料管理</h3>
            <p className="text-sm text-gray-500">上传资料，智能问答</p>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border">
            <div className="text-2xl mb-2">✅</div>
            <h3 className="font-semibold">每日打卡</h3>
            <p className="text-sm text-gray-500">记录进度，养成习惯</p>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold">学习反馈</h3>
            <p className="text-sm text-gray-500">每周总结，优化建议</p>
          </div>
        </div>

        {/* CTA 按钮 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/login">
            <Button size="lg" className="px-8">
              开始使用
            </Button>
          </Link>
          <Link href="/about">
            <Button variant="outline" size="lg" className="px-8">
              了解更多
            </Button>
          </Link>
        </div>
      </main>

      {/* 底部 */}
      <footer className="w-full py-6 text-center text-sm text-gray-500 border-t">
        <p>© 2026 AI 考研助手 · 助你高效备考</p>
      </footer>
    </div>
  );
}
