"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ModuleLinkItem {
  href: string;
  icon: string;
  label: string;
}

interface ModuleLinksProps {
  title?: string;
  links: ModuleLinkItem[];
  className?: string;
}

/**
 * 统一的"继续学习"卡片 — 替代各页面手贴的"相关模块"补丁。
 * 卡片与链接样式全站一致,消除拼合痕迹。
 */
export function ModuleLinks({ title = "继续学习", links, className }: ModuleLinksProps) {
  if (links.length === 0) return null;
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card p-5", className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:bg-muted hover:border-brand/40 transition-colors"
          >
            {l.icon} {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
