import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const coreExperiences = [
  {
    icon: "🎯",
    title: "知道今天做什么",
    desc: "从长期目标、当前阶段和里程碑推到本周方向与今日下一步。每项任务都能回到它服务的学习目标。",
    points: ["路线不是任务清单", "周计划先确认再生效", "调整保留历史证据"],
  },
  {
    icon: "📚",
    title: "在学习场景里执行",
    desc: "课程学习桌把课时、外部课程来源、学习记录、自评和必要的 AI 协作放在一起。",
    points: ["外部课程新标签页打开", "课程、任务与笔记关联", "练习与错题连续复习"],
  },
  {
    icon: "🧠",
    title: "留下自己的理解",
    desc: "记录理解、易错点和解题思路，并与知识节点、课程、练习和错题关联，而不只是收藏资料。",
    points: ["个人知识记录", "可回看的关联证据", "复习线索与知识图谱"],
  },
  {
    icon: "🤝",
    title: "AI 做学习管家",
    desc: "AI 先澄清目标、基础和时间容量，再给出可确认的计划建议，不替你判断是否真正掌握。",
    points: ["页面上下文协作", "说明调整影响", "支持自配模型 Key"],
  },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <section className="flex flex-col items-center justify-center px-6 py-20 text-center lg:py-28">
        <div className="mb-6 inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          🎓 C6 · 考研学习工作台
        </div>
        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-6xl">
          让每一天的学习，都走在一条看得见的路线上
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 lg:text-xl">
          面向刚起步、基础薄弱或学习混乱的考研学生。C6 将目标、阶段、周计划、课程、练习和自己的理解串成可追溯的学习闭环。
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link href="/login"><Button size="lg" className="px-10 text-base">开始建立学习路线</Button></Link>
          <Link href="/about"><Button variant="outline" size="lg" className="px-10 text-base">了解 C6</Button></Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">浏览器即用 · 核心功能免费 · AI 功能使用你自己配置的 API Key</p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20" id="features">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold lg:text-3xl">不是多一个待办工具，而是一条学习主线</h2>
          <p className="mt-2 text-slate-500">始终回答三个问题：现在处于哪里、接下来该做什么、这次学习留下了什么。</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {coreExperiences.map((item) => (
            <article key={item.title} className="rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900">
              <div className="mb-3 text-3xl">{item.icon}</div>
              <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              <ul className="space-y-1.5">
                {item.points.map((point) => <li key={point} className="flex gap-1.5 text-xs text-slate-500"><span className="text-blue-500">✓</span>{point}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-slate-900/50 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold lg:text-3xl">从方向到证据，逐步建立闭环</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", icon: "🧭", title: "确认目标与现状", desc: "先讨论目标、基础、可用时间和阶段标准，不仓促套用模板。" },
              { step: "2", icon: "🗓️", title: "执行本周的下一步", desc: "路线驱动周计划；课程、练习和错题复习都有明确入口。" },
              { step: "3", icon: "✍️", title: "留下理解并复盘", desc: "将理解、易错点和方法沉淀为关联证据，再由自己确认下一步。" },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-2xl dark:bg-blue-900/30">{item.icon}</div>
                <div className="mb-1 text-xs font-bold text-blue-500">步骤 {item.step}</div>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-16 text-center lg:py-20">
        <h2 className="text-2xl font-bold lg:text-3xl">AI 负责协作，不替你做学习判断</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-300">它可以帮助澄清计划、拆解课时目标、提示练习思路、归纳错因和检索资料；是否完成里程碑，仍由你的学习证据与复盘确认。</p>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-16 text-center text-white lg:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold lg:text-3xl">从今天开始，把备考串起来</h2>
          <p className="mb-8 mt-3 text-white/80">先建立一条可执行的路线，再完成今天最小的一步。</p>
          <Link href="/login"><Button size="lg" className="border-0 bg-white px-12 py-3 text-base text-blue-700 hover:bg-slate-100">免费开始使用 →</Button></Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-slate-400 dark:border-slate-800">
        <div className="mb-3 flex justify-center gap-6"><Link href="/about" className="hover:text-blue-500">关于 C6</Link><Link href="/privacy" className="hover:text-blue-500">隐私政策</Link><Link href="/terms" className="hover:text-blue-500">用户协议</Link><Link href="/suggestions" className="hover:text-blue-500">意见反馈</Link></div>
        <p>© 2026 C6 · AI 考研学习工作台</p>
      </footer>
    </div>
  )
}
