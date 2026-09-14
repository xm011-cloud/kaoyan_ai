/**
 * 认证服务偶发网络抖动时，避免把一个已有会话立即误判为未登录。
 *
 * 仅重试明确的传输层/5xx 错误；令牌失效、401 等仍然按未登录处理，
 * 保持受保护路由的 fail-closed 行为。
 */
type AuthUserResult<TUser> = {
  data: { user: TUser | null }
  error: unknown
}

function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { status?: number; message?: string; name?: string; cause?: unknown }
  if (typeof candidate.status === 'number' && candidate.status >= 500) return true

  const detail = [candidate.name, candidate.message, String(candidate.cause ?? '')]
    .filter(Boolean)
    .join(' ')

  return /fetch failed|network|timeout|timed out|socket|econnreset|econnrefused|eai_again/i.test(detail)
}

/** 一次短暂重试，避免页面跳转和 API 鉴权被瞬时认证故障打断。 */
export async function getAuthUserWithRetry<TUser, TResult extends AuthUserResult<TUser>>(
  getUser: () => Promise<TResult>,
): Promise<TResult> {
  const first = await getUser()
  if (first.data.user || !isTransientAuthError(first.error)) return first

  await new Promise<void>((resolve) => setTimeout(resolve, 200))
  return getUser()
}
