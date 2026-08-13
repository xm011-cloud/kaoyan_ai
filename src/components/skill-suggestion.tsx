'use client'

export interface SkillSuggestionData {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

interface Props {
  suggestion: SkillSuggestionData;
  onRun: (s: SkillSuggestionData) => void;
  onClose: () => void;
}

/** AI 主动提议的技能建议芯片：检测到关键词命中时出现在回复下方，一键运行，可关闭 */
export function SkillSuggestionChip({ suggestion, onRun, onClose }: Props) {
  return (
    <div className="mt-2 inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-brand-muted/60 border border-brand/20 text-xs text-brand">
      <span className="flex items-center gap-1">
        <span>💡</span>
        <span>
          你可能想用「{suggestion.icon} {suggestion.name}」
          {suggestion.description ? `：${suggestion.description.slice(0, 28)}…` : ""}
        </span>
      </span>
      <button
        onClick={() => onRun(suggestion)}
        className="px-2.5 py-1 rounded-full bg-brand text-white text-[11px] font-medium hover:bg-brand/90 transition-colors"
      >
        运行
      </button>
      <button
        onClick={onClose}
        aria-label="关闭技能建议"
        className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
