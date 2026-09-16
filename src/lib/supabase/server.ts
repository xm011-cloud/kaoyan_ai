import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { envConfig } from '@/lib/env-config'
import { getAuthUserWithRetry } from '@/lib/supabase/auth-retry'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    envConfig.projectUrl,
    envConfig.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component，忽略 set 操作
          }
        },
      },
    }
  )
}

/**
 * Server Component 的统一认证入口。
 * 正式运行始终通过 Auth 服务校验 token；隔离 E2E 在已完成真实登录后读取同一
 * cookie 内的 session，避免布局、页面和 API 对外重复校验而引入不一致的跳转。
 */
export async function getServerAuthUser() {
  const supabase = await createClient()
  if (process.env.E2E_TEST_MODE === "1") {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user ?? null
  }

  const {
    data: { user },
  } = await getAuthUserWithRetry(() => supabase.auth.getUser())
  return user
}
