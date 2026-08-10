/**
 * 导航定义
 *
 * navItems 保留平铺列表用于兼容旧代码
 * defaultNavGroups 是分组导航，用于 Header + MobileNav + Sidebar
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
  { href: '/dashboard',  label: '学习概览', icon: '🏠', shortLabel: '概览' },
  { href: '/checkin',    label: '打卡',     icon: '✅', shortLabel: '打卡' },
  { href: '/pomodoro',   label: '番茄钟',   icon: '🍅', shortLabel: '番茄' },
  { href: '/leaderboard', label: '学习圈',  icon: '🏆', shortLabel: '学习圈' },
  { href: '/goal',       label: '目标',     icon: '🎯', shortLabel: '目标' },
  { href: '/tasks',      label: '计划',     icon: '📋', shortLabel: '计划' },
  { href: '/practice',   label: '练习',     icon: '✏️', shortLabel: '练习' },
  { href: '/wrong-questions', label: '错题', icon: '📕', shortLabel: '错题' },
  { href: '/chat',       label: 'AI 对话',  icon: '💬', shortLabel: 'AI' },
  { href: '/feedback',   label: '周报',     icon: '📊', shortLabel: '周报' },
  { href: '/study-path', label: '学习路径', icon: '🗺️', shortLabel: '路径' },
  { href: '/materials',  label: '资料',     icon: '📖', shortLabel: '资料' },
  { href: '/knowledge-graph', label: '知识图谱', icon: '🧠', shortLabel: '图谱' },
  { href: '/admission',  label: '院校',     icon: '🏫', shortLabel: '院校' },
  { href: '/settings',   label: '偏好',     icon: '⚙️',  shortLabel: '设置' },
]

// ── 分组导航（Header tabs + MobileNav + Sidebar 共用）──
export const defaultNavGroups: NavGroup[] = [
  {
    id: 'today',
    label: '今日',
    icon: '📅',
    items: [
      { href: '/dashboard', label: '学习概览', icon: '🏠', shortLabel: '概览' },
      { href: '/checkin', label: '打卡', icon: '✅', shortLabel: '打卡' },
      { href: '/pomodoro', label: '番茄钟', icon: '🍅', shortLabel: '番茄' },
      { href: '/leaderboard', label: '学习圈', icon: '🏆', shortLabel: '学习圈' },
    ],
  },
  {
    id: 'exam',
    label: '备考',
    icon: '📝',
    items: [
      { href: '/goal', label: '目标', icon: '🎯', shortLabel: '目标' },
      { href: '/tasks', label: '计划', icon: '📋', shortLabel: '计划' },
      { href: '/practice', label: '练习', icon: '✏️', shortLabel: '练习' },
      { href: '/wrong-questions', label: '错题', icon: '📕', shortLabel: '错题' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    items: [
      { href: '/chat', label: 'AI 对话', icon: '💬', shortLabel: '对话' },
      { href: '/feedback', label: '周报', icon: '📊', shortLabel: '周报' },
      { href: '/study-path', label: '学习路径', icon: '🗺️', shortLabel: '路径' },
    ],
  },
  {
    id: 'knowledge',
    label: '知识',
    icon: '📚',
    items: [
      { href: '/materials', label: '资料', icon: '📖', shortLabel: '资料' },
      { href: '/knowledge-graph', label: '知识图谱', icon: '🧠', shortLabel: '图谱' },
      { href: '/admission', label: '院校', icon: '🏫', shortLabel: '院校' },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    items: [
      { href: '/settings', label: '偏好', icon: '⚙️', shortLabel: '设置' },
    ],
  },
]

// 辅助：从 navGroups 中查找 navItem
export function findNavItem(href: string): NavItem | undefined {
  return navItems.find((i) => i.href === href)
}
