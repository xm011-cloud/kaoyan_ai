'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getVisibleGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import { NavIcon } from '@/components/ui/nav-icon'

/** 桌面工作台的稳定导航层：页面切换不再依赖顶部标签或临时抽屉。 */
export function WorkspaceSidebar() {
  const pathname = usePathname()
  const groups = getVisibleGroups(useUIStore((state) => state.navGroups))
  const settingsItems = groups.find((group) => group.id === 'settings')?.items ?? []
  const collapsed = useUIStore((state) => state.workspaceSidebarCollapsed)
  const setCollapsed = useUIStore((state) => state.setWorkspaceSidebarCollapsed)

  return (
    <aside className={cn(
      'relative hidden shrink-0 flex-col border-r border-border/60 bg-card/70 py-4 transition-[width] duration-200 lg:flex',
      collapsed ? 'w-[68px] px-2' : 'w-60 px-3',
    )}>
      <div className={cn('mb-7 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-xl py-2 hover:bg-muted/60">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-semibold text-white shadow-sm">C6</span>
          {!collapsed && <span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-tight">学习工作台</span><span className="block text-[11px] text-muted-foreground">为今天的行动而设计</span></span>}
        </Link>
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="收起侧边栏" title="收起侧边栏">‹</button>
        )}
      </div>

      {collapsed && <button type="button" onClick={() => setCollapsed(false)} className="absolute -right-3 top-6 z-10 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-xs text-muted-foreground shadow-sm hover:text-foreground" aria-label="展开侧边栏" title="展开侧边栏">›</button>}

      <nav className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'space-y-3' : 'space-y-5')}>
        {groups.filter((group) => group.id !== 'settings').map((group) => (
          <section key={group.id}>
            {!collapsed && <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={cn(
                    'flex rounded-lg py-2 text-sm transition-colors',
                    collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5',
                    active ? 'bg-brand-muted font-medium text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}>
                    <NavIcon href={item.href} className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
                    {!collapsed && item.status === 'beta' && <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Beta</span>}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-3 space-y-0.5 border-t border-border/50 pt-3">
        {settingsItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={cn('flex rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground', collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5', active && 'bg-brand-muted font-medium text-brand')}>
              <NavIcon href={item.href} className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
              {!collapsed && item.status === 'beta' && <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Beta</span>}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
