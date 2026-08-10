import { cn } from '@/lib/utils'

// 名称 → 稳定的 HSL 色相，用于无头像时的首字符圆形 fallback
function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % 360
}

// 可复用头像：有 src 渲染 <img>（原生 img，next.config 未配 remotePatterns），
// 无 src 渲染首字符圆形 fallback（内联 style，避免 Tailwind 动态类被 purge）
export function Avatar({
  src,
  name = '',
  size = 40,
  className,
}: {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const label = name?.trim() || '头像'
  const initial = label.slice(0, 1).toUpperCase()

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        className={cn('rounded-full object-cover shrink-0', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        background: `hsl(${hashHue(name || 'U')} 65% 50%)`,
      }}
    >
      {initial}
    </div>
  )
}
