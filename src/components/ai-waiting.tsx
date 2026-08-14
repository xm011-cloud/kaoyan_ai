"use client";

import type { AiWaitPhase } from "@/hooks/use-ai-task";

/**
 * AI 等待安抚气泡 —— 等待状态机的渲染层
 *
 * - 分阶段文案轮播（label + detail）→ 知道在等什么
 * - 已等待时长 + 预估 → 知道要等多久
 * - 取消按钮 → 知道能随时离开（可逆性，减半等待焦虑）
 *
 * 用法：在 AI 请求进行中渲染，phase/estimate 来自 useAiTask，
 *       onCancel 绑到 task.cancel()（内部会 abort 对应 fetch）。
 */
export function AiWaiting({
  phase,
  estimate,
  onCancel,
  variant = "bubble",
}: {
  phase: AiWaitPhase;
  estimate: string;
  onCancel?: () => void;
  variant?: "bubble" | "inline";
}) {
  // 行内版：用在按钮/标题旁（周计划、学习路径、周报、变式题等页面级生成按钮）
  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex gap-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
        <span className="font-medium text-foreground/80">{phase.label}</span>
        <span>{estimate}</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="underline underline-offset-2 hover:text-foreground shrink-0"
            aria-label="取消本次生成"
          >
            取消
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="bg-card border border-border/50 px-4 py-3 rounded-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-2 h-2 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="text-sm font-medium text-foreground/80">{phase.label}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {phase.detail} · {estimate}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
              aria-label="取消本次生成"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
