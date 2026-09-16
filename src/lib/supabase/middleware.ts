import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { envConfig } from '@/lib/env-config'
import { getAuthUserWithRetry } from '@/lib/supabase/auth-retry'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    envConfig.projectUrl,
    envConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 生产请求远程校验用户。E2E 的状态文件只由真实登录产生；测试期间以其中的
  // Supabase auth cookie 作为“已登录”标识，避免每次页面导航都对外发起 Auth 请求。
  // 这条捷径只在显式 E2E_TEST_MODE 下存在，绝不改变生产鉴权语义。
  let user = null
  if (process.env.E2E_TEST_MODE === "1") {
    // Proxy 运行时的 RequestCookies 在某些 Next 16 生产构建中不会暴露大体积
    // Supabase 会话值；直接从标准 Cookie 请求头检查名称，避免把可信状态误判为登出。
    const hasPersistedAuthCookie = /(?:^|;\s*)sb-[^=;]+-auth-token=/.test(request.headers.get("cookie") ?? "")
    user = hasPersistedAuthCookie ? { id: "e2e-authenticated" } : null
  } else {
    const result = await getAuthUserWithRetry(() => supabase.auth.getUser())
    user = result.data.user
  }

  // 未登录用户访问受保护页面时重定向到登录页
  // 公开页面（/ /about /support）直接放行；/suggestions /admin 等保持登录保护
  const PUBLIC_PAGES = new Set(['/', '/about', '/support', '/forgot-password'])
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api') &&
    !PUBLIC_PAGES.has(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
