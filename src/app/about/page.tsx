import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "关于 - AI 考研助手",
  description: "AI 考研助手——智能备考，助你上岸",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-bold text-lg">AI 考研助手</span>
          </Link>
          <Link href="/login">
            <Button size="sm">开始使用</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 lg:py-20 text-center">
        <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          关于 AI 考研助手
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          AI 考研助手是一款专为考研学子打造的智能备考工具，利用人工智能技术帮助你科学规划复习、高效管理学习进度。
        </p>
      </section>

      {/* 项目由来 */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-8 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>💡</span> 为什么做这个项目
          </h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            <p>
              考研是一场持久战——从确定目标到最终考试，通常需要 6-12 个月的持续努力。在这个过程中，
              最大的挑战往往不是学习内容本身，而是<b className="text-gray-900 dark:text-white">如何科学规划、如何保持节奏、如何及时发现并纠正学习偏差</b>。
            </p>
            <p>
              传统的备考方式依赖纸质计划表和自我监督，容易出现计划脱离实际、执行难以追踪、
              缺乏客观反馈等问题。AI 考研助手希望用技术解决这些痛点，让 AI 成为每个考研人的专属学习教练。
            </p>
            <p>
              我们相信，<b className="text-gray-900 dark:text-white">好的工具能让努力更有效</b>。AI 考研助手免费开放给所有考研学子使用。
            </p>
          </div>
        </div>
      </section>

      {/* 功能总览 */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">核心功能</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: "🎯", title: "AI 智能规划",
              desc: "设定目标院校和考试日期后，AI 根据剩余天数自动生成三阶段（基础→强化→冲刺）完整学习计划，每个任务都有具体描述和预计时长。",
            },
            {
              icon: "📚", title: "资料管理 + RAG 问答",
              desc: "上传 .txt 或 PDF 考研资料后，AI 能基于资料内容进行智能问答——「这份笔记讲了什么？」、「帮我总结第三章」。",
            },
            {
              icon: "✅", title: "每日打卡追踪",
              desc: "记录每天的学习时长和状态，统计本周/总计学习时间，连续打卡天数可视化，培养坚持学习的好习惯。",
            },
            {
              icon: "📊", title: "AI 每周反馈",
              desc: "AI 自动分析你的打卡数据和任务完成情况，每周生成个性化学习报告和改进建议，帮你及时调整策略。",
            },
            {
              icon: "📈", title: "数据可视化",
              desc: "Dashboard 提供学习日历热力图、每周趋势折线图、状态分布饼图、各阶段任务进度图，一目了然。",
            },
            {
              icon: "📱", title: "全平台适配",
              desc: "桌面端侧边栏导航 + 移动端底部 TabBar，无论在电脑前还是手机上都能方便使用。",
            },
          ].map((f) => (
            <div key={f.title} className="p-6 bg-white dark:bg-gray-800 rounded-xl border hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 技术栈 */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-8 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>🛠️</span> 技术栈
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: "框架", value: "Next.js 16" },
              { label: "语言", value: "TypeScript" },
              { label: "样式", value: "Tailwind CSS 4" },
              { label: "组件", value: "shadcn/ui + Base UI" },
              { label: "数据库", value: "PostgreSQL + Prisma 7" },
              { label: "认证", value: "Supabase Auth" },
              { label: "AI 模型", value: "MiMo v2.5 Pro" },
              { label: "图表", value: "Recharts" },
              { label: "Markdown", value: "react-markdown" },
              { label: "PDF 解析", value: "pdf2json" },
              { label: "文件存储", value: "Supabase Storage" },
              { label: "部署", value: "Vercel" },
            ].map((t) => (
              <div key={t.label} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-500">{t.label}</p>
                <p className="text-sm font-medium">{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 联系方式 */}
      <section className="px-6 py-16 max-w-4xl mx-auto text-center">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white space-y-4">
          <h2 className="text-2xl font-bold">开始你的备考之旅</h2>
          <p className="text-white/80 max-w-md mx-auto">
            完全免费，无需下载，浏览器即用。让 AI 成为你的专属学习教练。
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 border-0 px-10">
              免费开始使用 →
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-400 border-t dark:border-gray-800">
        <p>© 2026 AI 考研助手 · 助你高效备考 · 上岸加油 🎓</p>
      </footer>
    </div>
  )
}
