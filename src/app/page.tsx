import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-20 lg:py-28 text-center">
        <div className="inline-flex items-center gap-1 px-3 py-1 mb-6 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
          🎓 2026 考研 · AI 加持备考
        </div>
        <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white max-w-3xl">
          AI 考研助手
        </h1>
        <p className="mt-4 text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
          智能制定学习计划 · 资料上传问答 · 每日打卡追踪 · AI 学习反馈
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="px-10 text-base">免费开始使用</Button>
          </Link>
          <Link href="/about">
            <Button variant="outline" size="lg" className="px-10 text-base">了解更多</Button>
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">无需下载 · 浏览器即用 · 产品免费（AI 功能需自配 API Key）</p>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-16 lg:py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl lg:text-3xl font-bold">核心功能</h2>
          <p className="text-gray-500 mt-2">覆盖考研备考全流程，AI 全程陪伴</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: "🎯", title: "目标规划", desc: "设定目标院校和专业，AI 根据考试日期和科目自动生成三阶段专属学习计划", points: ["智能拆分科目", "基础→强化→冲刺", "每日任务分配"] },
            { icon: "📚", title: "资料管理", desc: "上传考研资料（笔记、教材），AI 基于资料内容进行智能问答", points: ["文本自动提取", "关键词检索", "AI 上下文问答"] },
            { icon: "✅", title: "每日打卡", desc: "记录每天的学习时长和状态，培养坚持学习的好习惯", points: ["学习时长追踪", "状态记录", "连续打卡统计"] },
            { icon: "📊", title: "AI 反馈", desc: "AI 每周分析学习数据，给出个性化建议帮助你优化学习策略", points: ["每周学习周报", "数据趋势图表", "AI 个性化建议"] },
            { icon: "🍅", title: "番茄钟", desc: "专注 + 休息的番茄工作法，保持高效专注的学习节奏", points: ["25+5 科学节奏", "实时专注统计", "自动同步打卡"] },
            { icon: "📕", title: "错题本", desc: "错题自动收录、间隔重复复习，AI 生成同类题巩固薄弱点", points: ["SM-2 间隔复习", "错因分类", "AI 相似题生成"] },
            { icon: "🗺️", title: "学习路径", desc: "AI 分析薄弱环节，生成分阶段学习路径，里程碑式推进", points: ["薄弱点诊断", "阶段里程碑", "进度可视化"] },
            { icon: "🧠", title: "知识图谱", desc: "知识点关联可视化，看清知识脉络，快速定位薄弱环节", points: ["力导向图谱", "知识点关联", "错题联动"] },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-xl bg-white dark:bg-gray-800 border shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{item.desc}</p>
              <ul className="space-y-1">
                {item.points.map((p) => (
                  <li key={p} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="text-blue-500">✓</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 lg:py-20 bg-white dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl lg:text-3xl font-bold mb-4">三步开始</h2>
          <div className="grid sm:grid-cols-3 gap-8 mt-10">
            {[
              { step: "1", icon: "📝", title: "设置目标", desc: "填写目标院校、专业和考试日期" },
              { step: "2", icon: "🤖", title: "AI 生成计划", desc: "AI 自动生成三阶段完整复习计划" },
              { step: "3", icon: "✅", title: "每日执行打卡", desc: "按计划学习，完成每天打卡任务" },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-2xl mb-4">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-blue-500 mb-1">步骤 {item.step}</div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-16 lg:py-20 max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl lg:text-3xl font-bold mb-10">为什么选择 AI 考研助手</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { value: "AI 驱动", label: "智能规划引擎" },
            { value: "168 天", label: "最长覆盖周期" },
            { value: "30+", label: "AI 生成任务数" },
            { value: "产品免费", label: "AI 按你自配的 Key 计费" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl lg:text-3xl font-bold text-blue-600">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 lg:py-20 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold mb-3">准备好高效备考了吗？</h2>
          <p className="text-white/80 mb-8">加入 AI 考研助手，让 AI 成为你的专属学习伙伴</p>
          <p className="text-white/60 text-xs mb-6">产品完全免费；AI 功能需自备 OpenAI 兼容 API Key（支持 MiMo / DeepSeek / 通义千问等），AI 用量按你自己的 Key 计费</p>
          <Link href="/login">
            <Button size="lg" className="px-12 py-3 text-base bg-white text-blue-600 hover:bg-gray-100 border-0">
              立即开始 →
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-400 border-t dark:border-gray-800">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/about" className="hover:text-blue-500 transition-colors">关于我们</Link>
          <Link href="/suggestions" className="hover:text-blue-500 transition-colors">意见反馈</Link>
          <Link href="/support" className="hover:text-orange-500 transition-colors">☕ 支持作者</Link>
        </div>
        <p>© 2026 AI 考研助手 · 助你高效备考 · 上岸加油 🎓</p>
      </footer>
    </div>
  )
}
