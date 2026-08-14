import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '隐私政策 · AI 考研助手',
  description: 'AI 考研助手隐私政策 — 我们如何收集、使用和保护你的数据',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-bold text-lg">AI 考研助手</span>
          </Link>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">登录</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight">隐私政策</h1>
        <p className="text-sm text-gray-500">生效日期：2026-08-14</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">一、我们收集哪些信息</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li><b>账号信息</b>：注册时提供的邮箱、你设置的密码（加密存储于认证服务商）</li>
            <li><b>学习数据</b>：考研目标、学习计划、打卡记录、番茄钟记录、错题本、练习记录、导入的真题</li>
            <li><b>上传资料</b>：你主动上传的学习资料（PDF/TXT）及其内容，用于资料检索与 AI 问答</li>
            <li><b>AI 配置</b>：你在设置中填写的 AI API Key（仅用于调用你指定的 AI 服务，明文存储于数据库）</li>
            <li><b>院校数据反馈</b>：你在院校情报中的搜索、收藏、认同与质疑记录</li>
            <li><b>意见反馈</b>：你提交的评分、意见（可选择匿名）</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">二、数据存储与出境说明（重要）</h2>
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>1. <b>当前阶段（开发/测试期）：</b>为降低运营成本，本产品的服务器、数据库及认证服务部署于海外服务商（Vercel / Supabase / Neon 等）。你的账号信息、学习数据、上传的资料将存储于海外服务器。</p>
            <p>2. <b>迁移计划：</b>如项目持续运营且条件成熟（用户规模、合规要求等），我们将评估将服务迁回国内服务商（数据将一并迁移），届时另行告知。</p>
            <p>3. <b>你的选择：</b>如你不接受数据存储于海外，请勿注册或使用本产品；已注册用户可随时停止使用，并通过「设置 → 数据导出」导出全部数据，或提交注销请求删除账号数据。</p>
            <p>4. 我们将采取合理的技术措施保护你的数据安全（传输加密、访问控制、最小权限等）。</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">三、我们如何使用这些信息</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li>提供核心功能：计划生成、打卡统计、错题复习、院校情报、AI 问答等</li>
            <li>调用你配置的 AI 服务（你的 AI Key 仅用于向对应服务商发起请求）</li>
            <li>改进产品体验：依据学习数据提供周报、学习路径等个性化分析</li>
            <li>我们<b>不会</b>将你的个人信息出售、出租给任何第三方</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">四、你的权利</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li><b>访问与导出</b>：设置页一键导出你的全部学习数据（JSON）</li>
            <li><b>删除</b>：可在设置页提交「注销请求」，我们将在 7 个工作日内处理并删除你的账号与数据</li>
            <li><b>更正</b>：个人资料（昵称/头像）可随时修改</li>
            <li><b>撤回同意</b>：可随时停止使用本产品</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">五、第三方服务</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li><b>认证</b>：Supabase Auth（或 MemFire Cloud），负责账号注册与登录</li>
            <li><b>数据库</b>：Neon（PostgreSQL + pgvector）</li>
            <li><b>文件存储</b>：Supabase Storage（资料、头像）</li>
            <li><b>搜索</b>：Tavily（院校信息联网搜索）</li>
            <li><b>AI 服务</b>：由你自行配置（MiMo / DeepSeek / 通义千问 等 OpenAI 兼容服务），对话内容将发送至你配置的服务商</li>
          </ul>
          <p className="text-sm text-gray-500">上述服务商各自适用其隐私政策；我们仅在其允许范围内向其传输必要数据。</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">六、未成年人保护</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">本产品面向考研学生。根据中国法律规定，我们不会故意收集未满 14 周岁未成年人的个人信息；如发现误收集，请联系我们删除。</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">七、政策更新</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">本政策可能随产品与法规变化更新，更新后将在本页面公告。继续使用即视为接受更新后的政策。</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">八、联系我们</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">对本政策或数据处理有任何疑问，可通过「意见反馈」页面联系作者。</p>
        </section>
      </main>

      <footer className="py-8 text-center text-sm text-gray-400 border-t dark:border-gray-800">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/privacy" className="hover:text-blue-500 transition-colors">隐私政策</Link>
          <Link href="/terms" className="hover:text-blue-500 transition-colors">用户协议</Link>
          <Link href="/" className="hover:text-blue-500 transition-colors">返回首页</Link>
        </div>
        <p>© 2026 AI 考研助手</p>
      </footer>
    </div>
  )
}
