"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

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
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className?.includes("language-");
    return isInline ? (
      <code
        className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono text-pink-600 dark:text-pink-400"
        {...props}
      />
    ) : (
      <div className="my-2 rounded-lg overflow-hidden border dark:border-gray-700">
        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 text-[10px] text-gray-400 font-mono">
          {className?.replace("language-", "") || "code"}
        </div>
        <pre className="bg-gray-50 dark:bg-gray-900 p-3 overflow-x-auto text-xs font-mono leading-relaxed">
          <code {...props} />
        </pre>
      </div>
    );
  },
  a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  blockquote: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="border-l-3 border-blue-400 pl-3 my-2 text-gray-600 dark:text-gray-400 italic" {...props} />
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
  table: ({ ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border px-3 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium" {...props} />
  ),
  td: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border px-3 py-1.5" {...props} />
  ),
};

interface Source {
  id: string;
  name: string;
  score: number;
  preview: string;
  segments: string[];
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-blue-100 dark:border-blue-900/40 rounded-lg overflow-hidden bg-white dark:bg-gray-800/50">
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
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${source.score}%`,
                  backgroundColor: source.score >= 70 ? '#22C55E' : source.score >= 40 ? '#EAB308' : '#F97316',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 w-8 text-right">{source.score}%</span>
          </div>
          <span className="text-[10px] text-gray-400 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : '' }}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-md px-2.5 py-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
              {source.preview}
            </p>
          </div>

          {/* Matched segments */}
          {source.segments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <span>🔍</span> 匹配内容
              </p>
              {source.segments.map((seg, i) => (
                <div
                  key={i}
                  className="bg-amber-50 dark:bg-amber-900/10 border-l-2 border-amber-400 rounded-r-md px-2.5 py-1.5"
                >
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
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
  sources,
  onSaveToWrongBook,
}: {
  content: string;
  sources?: Source[];
  onSaveToWrongBook?: (content: string) => void;
}) {
  return (
    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
      {/* AI 回答 */}
      <ReactMarkdown components={components}>{content}</ReactMarkdown>

      {/* 加入错题本 */}
      {onSaveToWrongBook && content && content.length > 10 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onSaveToWrongBook(content)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <span>🔴</span>
            <span>加入错题本</span>
          </button>
        </div>
      )}

      {/* 引用材料 */}
      {sources && sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📚</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
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
