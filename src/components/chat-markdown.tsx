"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MermaidRenderer } from "@/components/mermaid-renderer";
import { AiThinking } from "@/components/ai-thinking";

const components = {
  h1: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props} />
  ),
  h2: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0" {...props} />
  ),
  h3: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <h4 className="text-sm font-bold mt-2 mb-1 first:mt-0" {...props} />
  ),
  p: ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-1.5 leading-relaxed" {...props} />
  ),
  ul: ({ ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...props} />
  ),
  ol: ({ ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...props} />
  ),
  li: ({ ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm leading-relaxed" {...props} />
  ),
  strong: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-gray-900 dark:text-white" {...props} />
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className?.includes("language-");
    const isMermaid = className?.includes("language-mermaid");

    if (isMermaid) {
      const code = String(children).replace(/\n$/, "");
      return <MermaidRenderer chart={code} />;
    }

    return isInline ? (
      <code
        className="px-1 py-0.5 bg-muted rounded text-xs font-mono text-brand"
        {...props}
      />
    ) : (
      <div className="my-2 rounded-xl overflow-hidden border border-border/50">
        <div className="bg-muted/80 px-3 py-1 text-[10px] text-muted-foreground font-mono">
          {className?.replace("language-", "") || "code"}
        </div>
        <pre className="bg-muted/50 p-3 overflow-x-auto text-xs font-mono leading-relaxed">
          <code {...props} />
        </pre>
      </div>
    );
  },
  img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const [broken, setBroken] = useState(false);

    if (broken || !src) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 my-1 rounded border border-border/50 bg-muted/50 text-xs text-muted-foreground">
          <span>🖼️</span>
          {alt || "图片无法显示"}
        </span>
      );
    }

    return (
      <img
        src={src}
        alt={alt || ""}
        className="max-w-full rounded-lg my-2 border border-border/50"
        onError={() => setBroken(true)}
        loading="lazy"
        {...props}
      />
    );
  },
  a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  blockquote: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="border-l-3 border-blue-400 pl-3 my-2 text-muted-foreground italic" {...props} />
  ),
  hr: () => <hr className="my-3 border-border/50" />,
  table: ({ ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-border/50 px-3 py-1.5 bg-muted/50 font-medium" {...props} />
  ),
  td: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-border/50 px-3 py-1.5" {...props} />
  ),
};

interface Source {
  id: string;
  name: string;
  score: number;
  preview: string;
  segments: string[];
}

interface ActionCard {
  type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated";
  title: string;
  detail: string;
}

function ActionCardView({ action }: { action: ActionCard }) {
  const iconMap: Record<string, string> = {
    task_created: "✅",
    task_completed: "☑️",
    checkin_created: "📝",
    reminder_updated: "🔔",
  };

  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-sm">
      <span className="shrink-0 text-base">{iconMap[action.type] || "⚡"}</span>
      <div className="min-w-0">
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          {action.title}
        </span>
        {action.detail && (
          <>
            {" "}
            <span className="text-muted-foreground">
              {action.detail}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-brand/20 rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">📄</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {source.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${source.score}%`,
                  backgroundColor: source.score >= 70 ? '#22C55E' : source.score >= 40 ? '#EAB308' : '#F97316',
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">{source.score}%</span>
          </div>
          <span className="text-[10px] text-muted-foreground transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : '' }}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Preview */}
          <div className="bg-muted/50 rounded-lg px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
              {source.preview}
            </p>
          </div>

          {/* Matched segments */}
          {source.segments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span>🔍</span> 匹配内容
              </p>
              {source.segments.map((seg, i) => (
                <div
                  key={i}
                  className="bg-amber-50 dark:bg-amber-900/10 border-l-2 border-amber-400 rounded-r-md px-2.5 py-1.5"
                >
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {seg}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatMarkdown({
  content,
  reasoning,
  sources,
  actions,
  onSaveToWrongBook,
}: {
  content: string;
  reasoning?: string;
  sources?: Source[];
  actions?: ActionCard[];
  onSaveToWrongBook?: (content: string) => void;
}) {
  return (
    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
      {/* 操作卡片 */}
      {actions && actions.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {actions.map((action, i) => (
            <ActionCardView key={i} action={action} />
          ))}
        </div>
      )}

      {/* AI 思考过程折叠层（设置可关） */}
      <AiThinking reasoning={reasoning} />

      {/* AI 回答 */}
      <ReactMarkdown components={components}>{content}</ReactMarkdown>

      {/* 加入错题本 */}
      {onSaveToWrongBook && content && content.length > 10 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <button
            onClick={() => onSaveToWrongBook(content)}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <span>🔴</span>
            <span>加入错题本</span>
          </button>
        </div>
      )}

      {/* 引用材料 */}
      {sources && sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📚</span>
            <span className="text-xs font-medium text-muted-foreground">
              引用了 {sources.length} 份资料
            </span>
          </div>
          {sources.map((s, i) => (
            <SourceCard key={s.id || i} source={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
