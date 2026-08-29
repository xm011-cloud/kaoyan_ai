/**
 * 导航定义（单一来源）
 *
 * - defaultNavGroups：分组导航，Header tabs + MobileNav + slide-over 共用
 * - getVisibleGroups：把 ui-store 的可见性偏好合进来，返回"可见的组 + 可见的 item"
 *   消费方（Header/MobileNav/slide-over/settings）都应调用它，不要各自重复过滤
 */
import type { NavGroup as UiNavGroup } from '@/stores/ui-store'

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
  /** 是否渲染为桌面 Header 顶部 tab（默认 true；如"设置"组用 ⚙️ 图标入口，不占 tab 位） */
  tab?: boolean
}

// ── 分组导航（Header tabs + MobileNav + slide-over 共用）──
export const defaultNavGroups: NavGroup[] = [
  {
    id: 'today',
    label: '今日',
    icon: '📅',
    items: [
      { href: '/dashboard', label: '学习概览', icon: '🏠', shortLabel: '概览' },
      { href: '/checkin', label: '打卡', icon: '✅', shortLabel: '打卡' },
      { href: '/pomodoro', label: '番茄钟', icon: '🍅', shortLabel: '番茄' },
      { href: '/leaderboard', label: '排行榜', icon: '🏆', shortLabel: '排行' },
    ],
  },
  {
    id: 'exam',
    label: '备考',
    icon: '📝',
    // 计划排最前：Header tab = 组首项 → 指向"计划"（备考规划中心），而非低频的"目标"
    items: [
      { href: '/tasks', label: '计划', icon: '📋', shortLabel: '计划' },
      { href: '/practice', label: '练习', icon: '✏️', shortLabel: '练习' },
      { href: '/wrong-questions', label: '错题', icon: '📕', shortLabel: '错题' },
      { href: '/goal', label: '目标', icon: '🎯', shortLabel: '目标' },
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
      { href: '/skills', label: '技能', icon: '⚡', shortLabel: '技能' },
    ],
  },
  {
    id: 'knowledge',
    label: '知识',
    icon: '📚',
    items: [
      { href: '/materials', label: '学习资料', icon: '📖', shortLabel: '资料' },
      { href: '/knowledge-graph', label: '知识图谱', icon: '🧠', shortLabel: '图谱' },
      { href: '/admission', label: '院校情报', icon: '🏫', shortLabel: '院校' },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    // 设置入口用右上角 ⚙️ 图标，不占 Header tab 位（组本身仍保留在 slide-over 菜单里）
    tab: false,
    items: [
      { href: '/settings', label: '设置', icon: '⚙️', shortLabel: '设置' },
      { href: '/profile', label: '个人资料', icon: '👤', shortLabel: '主页' },
      { href: '/changelog', label: '更新日志', icon: '📣', shortLabel: '更新' },
    ],
  },
]

/**
 * 合并 ui-store 可见性偏好 → 返回"可见的组 + 可见的 item"（丢弃空组）。
 * 四个消费方统一走这里，新增导航项 / 调显隐只改 defaultNavGroups。
 */
export function getVisibleGroups(uiGroups: UiNavGroup[] | undefined): NavGroup[] {
  return defaultNavGroups
    .map((dg) => {
      const ui = uiGroups?.find((g) => g.id === dg.id)
      if (ui && ui.visible === false) return null
      const items = dg.items.filter((item) => {
        const uiItem = ui?.items.find((i) => i.href === item.href)
        return uiItem?.visible ?? true
      })
      return items.length > 0 ? { ...dg, items } : null
    })
    .filter((g): g is NavGroup => g !== null)
}
