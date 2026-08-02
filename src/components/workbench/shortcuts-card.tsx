'use client'

import Link from 'next/link'

const shortcuts = [
  { href: '/checkin', icon: '✅', label: '打卡' },
  { href: '/goal', icon: '🎯', label: '目标' },
  { href: '/chat', icon: '💬', label: 'AI 问答' },
  { href: '/knowledge-graph', icon: '🧠', label: '知识图谱' },
  { href: '/study-path', icon: '🗺️', label: '学习路径' },
  { href: '/admission', icon: '🏫', label: '院校' },
]

export function ShortcutsCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <h3 className="font-semibold mb-3">快捷入口</h3>
      <div className="grid grid-cols-3 gap-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
