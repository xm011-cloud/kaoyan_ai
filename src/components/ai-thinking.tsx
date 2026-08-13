"use client";

import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";

/**
 * AI 思考过程折叠层（非流式第一层）
 *
 * - 受 ui-store `showAiThinking` 开关控制（设置页可关）
 * - 折叠态只显示一行摘要，展开显示完整思考过程（限高滚动）
 * - 渲染在 assistant 消息正文上方，永远不抢正文焦点
 */
export function AiThinking({ reasoning }: { reasoning?: string }) {
  const showAiThinking = useUIStore((s) => s.showAiThinking);
  const [expanded, setExpanded] = useState(false);

  if (!showAiThinking || !reasoning) return null;

  return (
    <div className="mb-2 rounded-xl border border-border/50 bg-muted/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>💭</span>
          <span className="font-medium">AI 思考过程</span>
        </span>
        <span className="text-[10px] text-muted-foreground transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "" }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="max-h-64 overflow-y-auto rounded-lg bg-background/60 border border-border/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {reasoning}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
