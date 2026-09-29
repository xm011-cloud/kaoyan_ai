import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "关于 C6 · AI 考研学习工作台",
  description: "C6 帮助考研学生将目标、计划、学习和理解记录串成可追溯的学习闭环。",
}

const capabilities = [
  {
    icon: "🧭",
    title: "路线先于任务",
    desc: "先确认目标、基础、时间容量与阶段标准，再建立阶段路线和里程碑。周计划与今日任务始终能追溯到这条路线。",
  },
  {
    icon: "📖",
    title: "学习不是只勾选任务",
    desc: "课程、练习、错题和复习构成连续学习场景。完成任务会留下学习证据，但不会被系统直接宣告为“掌握”。",
  },
  {
    icon: "✍️",
    title: "沉淀自己的理解",
    desc: "把理解、易错点、解题思路与知识节点、课程和练习关联，让之后的复习能找到当时真正卡住的地方。",
  },
  {
    icon: "🤝",
    title: "AI 作为学习管家",
    desc: "AI 在当前页面提供可确认的计划、课时、练习与资料协作建议，并明确调整影响；最终的学习判断仍由用户自己完成。",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2"><span className="text-xl">🎓</span><span className="text-lg font-bold">C6 · AI 考研学习工作台</span></Link>
          <Link href="/login"><Button size="sm">开始使用</Button></Link>
        </div>
      </header>

      <section className="px-6 py-16 text-center lg:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-blue-600">关于 C6</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-5xl">让考研学习有主线，也留下证据</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">C6 是一个面向考研学生的一站式学习工作台。它不试图替你学习，而是让目标、计划、每天的行动和自己的理解能够连在一起。</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="space-y-4 rounded-2xl border bg-white p-8 shadow-sm dark:bg-slate-900">
          <h2 className="text-2xl font-bold">我们想解决的，不只是“计划排不出来”</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">考研常常从一堆课程、资料、错题和焦虑开始。真正困难的是：不知道该先补什么、不知道一周做到什么算推进、学过的内容没有沉淀，计划一变又像要全部推倒重来。</p>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">C6 因此把产品中心放在可解释的学习闭环上：目标定义方向，阶段和里程碑定义阶段成果，周计划安排容量，今日任务指向行动，课程与练习留下证据，理解记录再连接到个人知识脉络。</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">C6 如何工作</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {capabilities.map((capability) => (
            <article key={capability.title} className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-3 text-3xl">{capability.icon}</div>
              <h3 className="mb-2 text-lg font-bold">{capability.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{capability.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 dark:border-blue-950 dark:bg-blue-950/30">
          <h2 className="text-2xl font-bold">AI 的边界</h2>
          <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">AI 可以帮助澄清计划、理解课时、提示练习思路、归纳错因与检索资料。它会在生成计划前询问关键前提，也不会把完成若干任务直接等同于掌握知识。用户可以配置自己的 OpenAI 兼容 API Key；C6 不是高频泛问答聊天工具的替代品。</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><span>🛠️</span> 技术栈</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              { label: "框架", value: "Next.js 16" }, { label: "语言", value: "TypeScript" },
              { label: "界面", value: "Tailwind CSS 4" }, { label: "数据库", value: "PostgreSQL + Prisma" },
              { label: "知识检索", value: "pgvector" }, { label: "认证", value: "Supabase Auth" },
              { label: "AI", value: "OpenAI 兼容接口" }, { label: "部署", value: "Vercel" },
            ].map((item) => <div key={item.label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-1 font-medium">{item.value}</p></div>)}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <h2 className="text-2xl font-bold">先完成今天最小的一步</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">核心功能免费，浏览器即可使用。需要 AI 时，配置自己的兼容 API Key 即可。</p>
          <Link href="/login"><Button size="lg" className="mt-6 border-0 bg-white px-10 text-blue-700 hover:bg-slate-100">免费开始使用 →</Button></Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-slate-400 dark:border-slate-800">
        <div className="mb-3 flex justify-center gap-6"><Link href="/privacy" className="hover:text-blue-500">隐私政策</Link><Link href="/terms" className="hover:text-blue-500">用户协议</Link><Link href="/" className="hover:text-blue-500">返回首页</Link></div>
        <p>© 2026 C6 · AI 考研学习工作台</p>
      </footer>
    </div>
  )
}
