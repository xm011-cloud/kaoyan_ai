'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { defaultNavGroups } from '@/lib/nav'
import { useUIStore } from '@/stores/ui-store'

/**
 * Mobile bottom tab bar — Apple HIG Tab Bar pattern
 * - Fixed at bottom, height 49pt + safe-area (h-14)
 * - Minimum 44pt touch targets per tab (use full height)
 * - Text labels always visible (never icon-only)
 */
export function MobileNav() {
  const pathname = usePathname()
  const uiGroups = useUIStore((s) => s.navGroups)

  const groups = defaultNavGroups
    .filter((dg) => { const ui = uiGroups.find(g => g.id === dg.id); return ui?.visible ?? true })
    .map((dg) => {
      const ui = uiGroups.find(g => g.id === dg.id)
      return { ...dg, items: dg.items.filter(item => { const uiI = ui?.items.find(i => i.href === item.href); return uiI?.visible ?? true }) }
    })
    .filter(g => g.items.length > 0)
    .slice(0, 5)

  return (
    <nav className="lg:hidden shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {groups.map((group) => {
          const href = group.items[0]?.href || '/dashboard'
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={group.id}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-[0.97]',
                isActive ? 'text-brand' : 'text-muted-foreground/60'
              )}
            >
              <span className="text-lg leading-none">{group.icon}</span>
              <span className="text-[10px] font-medium leading-none">{group.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
