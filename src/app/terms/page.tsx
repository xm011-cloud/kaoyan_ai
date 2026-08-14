import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '用户协议 · AI 考研助手',
  description: 'AI 考研助手用户协议 — 使用本产品前请阅读',
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-extrabold tracking-tight">用户协议</h1>
        <p className="text-sm text-gray-500">生效日期：2026-08-14</p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">一、服务说明</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            AI 考研助手是一款面向考研学生的备考工具，提供计划管理、打卡统计、错题复习、院校情报、AI 问答等功能。
            产品当前为<b>免费 + 邀请制</b>使用，作者为个人开发者，产品仍处于持续开发阶段。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">二、AI 功能特别说明</h2>
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>1. <b>自带 Key 模式</b>：AI 功能需要你自行配置 OpenAI 兼容 API Key（MiMo / DeepSeek / 通义千问等），AI 用量按你自己的 Key 计费，与本产品收费无关。不配置 AI Key 不影响打卡、番茄钟、错题本等非 AI 功能。</p>
            <p>2. <b>内容不保证准确</b>：AI 生成的内容（计划、解析、院校信息提取等）可能存在错误或过时，请务必以官方公布为准。你应对 AI 生成内容的使用自行判断并承担相应风险。</p>
            <p>3. <b>内容传输</b>：使用 AI 功能时，对话内容与相关数据会发送至你配置的 AI 服务商（境外服务商可能位于海外）。</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">三、版权声明</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li><b>院校情报数据</b>：分数线、招生人数等来源于公开网络搜索，每条数据标注了来源与年份，仅作参考；请以中国研究生招生信息网（yz.chsi.com.cn）及各校研究生院官方公布为准。</li>
            <li><b>考研真题</b>：真题内容版权归命题单位或权利人所有。本产品中的真题为<b>用户个人学习用途</b>的本地导入，不提供跨用户共享；请勿将导入的真题用于商业用途或对外传播。</li>
            <li><b>产品代码</b>：本产品代码以 Apache-2.0 协议开源（GitHub 公开仓库），欢迎学习交流。</li>
            <li>如你认为本产品中展示了侵犯你权利的内容，可通过「意见反馈」提交举报，我们将在核实后处理。</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">四、用户行为规范</h2>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
            <li>不得利用本产品从事违法活动或传播违法违规内容</li>
            <li>不得恶意攻击、滥用本产品（如高频请求、绕过限流、爬取他人数据）</li>
            <li>不得冒用他人身份注册</li>
            <li>违反上述规范，作者有权在不另行通知的情况下暂停或终止服务</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">五、免责声明</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            本产品按「现状」提供。作者不对以下事项作任何明示或默示保证：功能的持续可用性、数据的完整性或准确性、
            AI 生成内容的正确性。因使用本产品产生的任何直接或间接损失（包括但不限于依赖院校信息或 AI 内容作出的决策），作者不承担责任。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">六、账号与数据</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            你可以随时停止使用本产品。如需删除账号与数据，可在「设置」页提交注销请求，我们将于 7 个工作日内处理。
            数据收集与处理详见 <Link href="/privacy" className="text-blue-600 hover:underline">《隐私政策》</Link>。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">七、协议变更</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            本协议可能随产品与法规变化更新。重大变更将在本页面及产品内公告；继续使用即视为接受更新后的协议。
          </p>
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
