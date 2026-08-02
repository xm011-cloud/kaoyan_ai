"use client";

import { Button } from "@/components/ui/button";

export type GenerationMode = "daily_review" | "spaced_review" | "mock_exam" | "custom" | "material_based";

interface SessionCreatorProps {
  subjects: string[];
  todaySubjects: string[];
  dueWrongCount: number;
  mode: GenerationMode;
  subject: string;
  count: number;
  duration: number;
  difficulty: number;
  includeMermaid: boolean;
  includeWeakPoints: boolean;
  creating: boolean;
  onModeChange: (mode: GenerationMode) => void;
  onSubjectChange: (subject: string) => void;
  onCountChange: (count: number) => void;
  onDurationChange: (duration: number) => void;
  onDifficultyChange: (difficulty: number) => void;
  onIncludeMermaidChange: (v: boolean) => void;
  onIncludeWeakPointsChange: (v: boolean) => void;
  onCreate: () => void;
}

const modeCards = [
  {
    mode: "daily_review" as const,
    icon: "🎯",
    title: "今日巩固",
    desc: "基于今天学了什么，量身出题巩固",
    color: "blue",
  },
  {
    mode: "spaced_review" as const,
    icon: "🔄",
    title: "间隔复习",
    desc: "基于遗忘曲线，复习到期错题",
    color: "orange",
  },
  {
    mode: "mock_exam" as const,
    icon: "⏱️",
    title: "模拟考试",
    desc: "限时模考，检验真实水平",
    color: "purple",
  },
  {
    mode: "material_based" as const,
    icon: "📎",
    title: "资料出题",
    desc: "基于上传的教材和资料出题",
    color: "green",
  },
  {
    mode: "custom" as const,
    icon: "🔧",
    title: "自由定制",
    desc: "完全自定义出题参数",
    color: "gray",
  },
] as const;

const colorClasses = {
  blue: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
  orange: "border-orange-500 bg-orange-50 dark:bg-orange-900/20",
  purple: "border-purple-500 bg-purple-50 dark:bg-purple-900/20",
  green: "border-green-500 bg-green-50 dark:bg-green-900/20",
  gray: "border-gray-400 bg-gray-50 dark:bg-gray-800",
} as const;

export function SessionCreator({
  subjects,
  todaySubjects,
  dueWrongCount,
  mode,
  subject,
  count,
  duration,
  difficulty,
  includeMermaid,
  includeWeakPoints,
  creating,
  onModeChange,
  onSubjectChange,
  onCountChange,
  onDurationChange,
  onDifficultyChange,
  onIncludeMermaidChange,
  onIncludeWeakPointsChange,
  onCreate,
}: SessionCreatorProps) {
  return (
    <>
      {/* Mode cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {modeCards.map((card) => {
          const isActive = mode === card.mode;
          const hoverColor =
            card.color === "blue"
              ? "hover:border-blue-300"
              : card.color === "orange"
              ? "hover:border-orange-300"
              : card.color === "purple"
              ? "hover:border-purple-300"
              : card.color === "green"
              ? "hover:border-green-300"
              : "hover:border-gray-300";

          return (
            <button
              key={card.mode}
              onClick={() => onModeChange(card.mode)}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                isActive
                  ? colorClasses[card.color]
                  : `border-gray-200 dark:border-gray-700 ${hoverColor}`
              }`}
            >
              <div className="text-xl mb-1">{card.icon}</div>
              <h4 className="font-bold text-xs sm:text-sm">{card.title}</h4>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2">
                {card.mode === "daily_review" && todaySubjects.length > 0
                  ? `今日学了：${todaySubjects.slice(0, 2).join("、")}`
                  : card.mode === "spaced_review"
                  ? `${dueWrongCount > 0 ? `${dueWrongCount} 题到期` : "暂无到期"}`
                  : card.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Config */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Subject */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium mb-1">科目</label>
            <select
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              {subjects.length === 0 && (
                <option value="">请先设置考研目标</option>
              )}
            </select>
          </div>

          {/* Count */}
          <div className="w-24">
            <label className="block text-sm font-medium mb-1">题数</label>
            <select
              value={count}
              onChange={(e) => onCountChange(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          {/* Duration (mock only) */}
          {mode === "mock_exam" && (
            <div className="w-32">
              <label className="block text-sm font-medium mb-1">时长(分钟)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => onDurationChange(parseInt(e.target.value) || 180)}
                min={30}
                max={360}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
          )}

          {/* Difficulty slider */}
          <div className="w-40">
            <label className="block text-sm font-medium mb-1">
              难度：{Math.round(difficulty * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(difficulty * 100)}
              onChange={(e) => onDifficultyChange(parseInt(e.target.value) / 100)}
              className="w-full accent-blue-500"
            />
          </div>

          <Button
            onClick={onCreate}
            disabled={creating || !subject}
            className={mode === "mock_exam" ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {creating ? "生成中..." : "开始练习 ✏️"}
          </Button>
        </div>

        {/* Advanced options */}
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
            ⚙️ 更多选项
          </summary>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMermaid}
                onChange={(e) => onIncludeMermaidChange(e.target.checked)}
                className="rounded"
              />
              允许图表（Mermaid/表格）
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeakPoints}
                onChange={(e) => onIncludeWeakPointsChange(e.target.checked)}
                className="rounded"
              />
              涵盖错题知识点
            </label>
          </div>
        </details>
      </div>
    </>
  );
}
