import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 认证回调枢纽（双模式，兼容 PKCE 与 token_hash）：
// 1. ?code=…            —— Supabase 默认 PKCE 邮件链接（同浏览器），exchangeCodeForSession 交换
// 2. ?token_hash=…&type= — 管理员后台 generateLink → hashed_token 自建链接（跨浏览器），verifyOtp 免 verifier
// 成功且 type=recovery 时跳转 /update-password 设置新密码。
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'recovery') as
    | 'recovery'
    | 'magiclink'
    | 'signup'
    | 'invite'
    | 'email_change'
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code && !token_hash) {
    return NextResponse.redirect(`${origin}/login?error=recovery`)
  }

  const supabase = await createClient()
  try {
    if (token_hash) {
      // 管理员生成的链接：无需 verifier，跨浏览器可用
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })
      if (error) throw error
    } else {
      const { error } = await supabase.auth.exchangeCodeForSession(code!)
      if (error) throw error
    }
    return NextResponse.redirect(
      type === 'recovery' ? `${origin}/update-password` : `${origin}${next}`
    )
  } catch {
    return NextResponse.redirect(`${origin}/login?error=recovery`)
  }
}
