/**
 * 导航定义
 *
 * navItems 保留平铺列表用于兼容旧代码
 * navGroups 是分组导航，用于新 Sidebar
 */

export interface NavItem {
  href: string
  label: string
  icon: string
  shortLabel: string
}

export interface NavGroup {
  id: string
  label: string
  icon: string
  items: NavItem[]
}

// ── 平铺列表（兼容旧引用）──
export const navItems: NavItem[] = [
  { href: '/dashboard',  label: '仪表盘',  icon: '🏠', shortLabel: '首页' },
  { href: '/goal',       label: '我的目标', icon: '🎯', shortLabel: '目标' },
  { href: '/tasks',      label: '学习计划', icon: '📋', shortLabel: '计划' },
  { href: '/checkin',    label: '每日打卡', icon: '✅', shortLabel: '打卡' },
  { href: '/pomodoro',   label: '番茄钟',   icon: '🍅', shortLabel: '番茄' },
  { href: '/admission',  label: '院校情报', icon: '🏫', shortLabel: '院校' },
  { href: '/materials',  label: '学习资料', icon: '📚', shortLabel: '资料' },
  { href: '/chat',       label: 'AI 问答',  icon: '💬', shortLabel: 'AI' },
  { href: '/wrong-questions', label: '错题本', icon: '🔴', shortLabel: '错题' },
  { href: '/practice',   label: '练习',     icon: '✏️', shortLabel: '练习' },
  { href: '/feedback',   label: '学习反馈', icon: '📊', shortLabel: '反馈' },
  { href: '/knowledge-graph', label: '知识图谱', icon: '🧠', shortLabel: '图谱' },
  { href: '/study-path', label: '学习路径', icon: '🗺️', shortLabel: '路径' },
  { href: '/settings',   label: '设置',     icon: '⚙️',  shortLabel: '设置' },
]

// ── 分组导航（新 Sidebar 使用）──
export const defaultNavGroups: NavGroup[] = [
  {
    id: 'overview',
    label: '学习概览',
    icon: '📊',
    items: [
      { href: '/dashboard', label: '仪表盘', icon: '🏠', shortLabel: '首页' },
      { href: '/feedback', label: '学习反馈', icon: '📊', shortLabel: '反馈' },
      { href: '/knowledge-graph', label: '知识图谱', icon: '🧠', shortLabel: '图谱' },
    ],
  },
  {
    id: 'daily',
    label: '今日学习',
    icon: '📝',
    items: [
      { href: '/checkin', label: '每日打卡', icon: '✅', shortLabel: '打卡' },
      { href: '/pomodoro', label: '番茄钟', icon: '🍅', shortLabel: '番茄' },
      { href: '/tasks', label: '学习计划', icon: '📋', shortLabel: '计划' },
    ],
  },
  {
    id: 'practice',
    label: '练习备考',
    icon: '✏️',
    items: [
      { href: '/practice', label: '练习', icon: '✏️', shortLabel: '练习' },
      { href: '/wrong-questions', label: '错题本', icon: '🔴', shortLabel: '错题' },
      { href: '/admission', label: '院校情报', icon: '🏫', shortLabel: '院校' },
    ],
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: '📚',
    items: [
      { href: '/materials', label: '学习资料', icon: '📚', shortLabel: '资料' },
      { href: '/chat', label: 'AI 问答', icon: '💬', shortLabel: 'AI' },
      { href: '/study-path', label: '学习路径', icon: '🗺️', shortLabel: '路径' },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    items: [
      { href: '/goal', label: '我的目标', icon: '🎯', shortLabel: '目标' },
      { href: '/settings', label: '设置', icon: '⚙️', shortLabel: '设置' },
    ],
  },
]

// 辅助：从 navGroups 中查找 navItem
export function findNavItem(href: string): NavItem | undefined {
  return navItems.find((i) => i.href === href)
}
