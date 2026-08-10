'use client'

import Link from 'next/link'

const shortcuts = [
  { href: '/chat', icon: '🤖', label: 'AI 助手' },
  { href: '/checkin', icon: '✅', label: '打卡' },
  { href: '/goal', icon: '🎯', label: '目标' },
  { href: '/practice', icon: '✏️', label: '练习' },
  { href: '/wrong-questions', icon: '📕', label: '错题' },
  { href: '/knowledge-graph', icon: '🧠', label: '图谱' },
]

export function ShortcutsCard() {
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold">🔗 快捷入口</h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors active:scale-[0.97]"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
