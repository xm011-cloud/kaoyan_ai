import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowUpRight, Clock3, FileText, GraduationCap, Sparkles, Wrench } from "lucide-react";

type ToolStatus = "available" | "beta" | "paused";

const STATUS_COPY: Record<ToolStatus, { label: string; className: string }> = {
  available: { label: "可用", className: "bg-success/10 text-success" },
  beta: { label: "Beta", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  paused: { label: "暂未开放", className: "bg-muted text-muted-foreground" },
};

const tools = [
  {
    href: "/materials",
    title: "学习资料",
    description: "上传和整理可复制文本的资料，供学习时查阅与 AI 引用。扫描件、图片和复杂公式资料会明确提示当前不可检索。",
    status: "available" as const,
    icon: FileText,
  },
  {
    href: "/pomodoro",
    title: "番茄钟",
    description: "独立记录专注时段；它辅助今天的学习，不替代计划、课程和练习主流程。",
    status: "available" as const,
    icon: Clock3,
  },
  {
    href: "/skills",
    title: "AI 技能",
    description: "面向特定任务的 AI 流程。结果仍需你确认，当前不作为制定学习计划的必要步骤。",
    status: "beta" as const,
    icon: Sparkles,
  },
  {
    href: "/knowledge-graph",
    title: "知识图谱",
    description: "用于查看知识关联；当积累足够课程、练习和错题证据后，它才有稳定的解释价值。",
    status: "beta" as const,
    icon: Wrench,
  },
  {
    href: "/admission",
    title: "院校情报",
    description: "用于收集和对比院校信息。请以招生单位发布的最新简章和目录为准。",
    status: "beta" as const,
    icon: GraduationCap,
  },
];

const pausedItems = [
  "排行榜与社区：先验证个人学习闭环，不以比较和互动分散学习注意力。",
  "内置视频课程与课程市场：当前只记录用户已有课程及其外部来源。",
  "自由拖拽插件桌面、无纸化手写：暂不进入本阶段开发，避免影响学习主链稳定性。",
];

export default function ToolsPage() {
  return (
    <div className="workspace-page">
      <div className="mx-auto max-w-4xl space-y-7">
        <PageHeader
          title="更多工具"
          subtitle="核心学习链之外的辅助能力。Beta 功能可以体验，但不会影响你的路线、任务和学习记录。"
        />

        <section className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
          <p className="text-sm font-semibold text-brand">先完成学习主链</p>
          <p className="mt-1 text-sm text-muted-foreground">建议优先使用：目标与路线 → 本周计划 → 今日任务 → 课程 / 练习 / 错题复习。这里的工具只在它们确实能帮上忙时再打开。</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const status = STATUS_COPY[tool.status];
            return (
              <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-brand/30 hover:bg-muted/30">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{tool.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                      <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
          <h2 className="font-semibold">暂未开放</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {pausedItems.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
