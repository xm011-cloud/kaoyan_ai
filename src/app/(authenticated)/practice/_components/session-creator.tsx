"use client";

import { Button } from "@/components/ui/button";

export type GenerationMode = "daily_review" | "spaced_review" | "mock_exam" | "custom" | "material_based" | "exam_questions";

interface SessionCreatorProps {
  subjects: string[]; todaySubjects: string[]; dueWrongCount: number;
  mode: GenerationMode; subject: string; count: number; duration: number;
  difficulty: number; includeMermaid: boolean; includeWeakPoints: boolean; creating: boolean;
  onModeChange: (m: GenerationMode) => void;
  onSubjectChange: (s: string) => void; onCountChange: (n: number) => void;
  onDurationChange: (d: number) => void; onDifficultyChange: (d: number) => void;
  onIncludeMermaidChange: (v: boolean) => void; onIncludeWeakPointsChange: (v: boolean) => void;
  onCreate: () => void;
}

const modes = [
  { mode: "daily_review" as const, icon: "🎯", title: "今日巩固", desc: "基于今天学的内容" },
  { mode: "spaced_review" as const, icon: "🔄", title: "间隔复习", desc: "遗忘曲线复习" },
  { mode: "mock_exam" as const, icon: "⏱️", title: "模拟考试", desc: "限时全真模考" },
  { mode: "material_based" as const, icon: "📎", title: "资料出题", desc: "基于上传资料" },
  { mode: "exam_questions" as const, icon: "📚", title: "真题练习", desc: "用导入的真题" },
  { mode: "custom" as const, icon: "🔧", title: "自由定制", desc: "完全自定义" },
] as const;

export function SessionCreator(p: SessionCreatorProps) {
  return (
    <>
      {/* Mode selector — segmented control style */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted overflow-x-auto">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => p.onModeChange(m.mode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97] ${
              p.mode === m.mode
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{m.icon}</span>
            <span className="hidden sm:inline">{m.title}</span>
          </button>
        ))}
      </div>

      {/* Config card */}
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Subject */}
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">科目</label>
            <select value={p.subject} onChange={(e) => p.onSubjectChange(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20">
              {p.subjects.map((s) => <option key={s}>{s}</option>)}
              {p.subjects.length === 0 && <option>请先设置目标</option>}
            </select>
          </div>

          {/* Count */}
          <div className="w-20">
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">题数</label>
            <select value={p.count} onChange={(e) => p.onCountChange(+e.target.value)}
              className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20">
              {[5, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>

          {/* Duration (mock only) */}
          {p.mode === "mock_exam" && (
            <div className="w-28">
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">时长(分)</label>
              <input type="number" value={p.duration} onChange={(e) => p.onDurationChange(+e.target.value || 180)}
                min={30} max={360}
                className="w-full h-11 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
          )}

          {/* Difficulty */}
          <div className="w-36">
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
              难度 {Math.round(p.difficulty * 100)}%
            </label>
            <input type="range" min={0} max={100} value={Math.round(p.difficulty * 100)}
              onChange={(e) => p.onDifficultyChange(+e.target.value / 100)}
              className="w-full h-11 accent-brand" />
          </div>

          <Button onClick={p.onCreate} disabled={p.creating || !p.subject}
            className="h-11 px-6 rounded-full font-semibold text-sm bg-brand hover:bg-brand/90 text-brand-foreground active:scale-[0.98] transition-all">
            {p.creating ? "生成中..." : "开始练习"}
          </Button>
        </div>

        {/* Options row */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">⚙️ 更多选项</summary>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.includeMermaid} onChange={(e) => p.onIncludeMermaidChange(e.target.checked)} className="rounded" />
              <span className="text-sm text-muted-foreground">允许图表</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.includeWeakPoints} onChange={(e) => p.onIncludeWeakPointsChange(e.target.checked)} className="rounded" />
              <span className="text-sm text-muted-foreground">涵盖错题</span>
            </label>
          </div>
        </details>
      </div>
    </>
  );
}
