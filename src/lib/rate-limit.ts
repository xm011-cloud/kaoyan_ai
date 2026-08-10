import { NextRequest } from "next/server";

/**
 * 按 IP 的进程内限流 + 蜜罐 + 安全 JSON 解析，供所有公开/登录 POST 接口复用。
 * 限流仅生产环境生效（避免 dev/Playwright 自限流）。
 * 注：serverless 多实例下为 per-instance 计数，属低成本威慑，非强保证。
 */

// key = `${feature}:${ip}`，每个接口独立计数桶
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_MS = 60_000;
const CLEANUP_THRESHOLD = 1000;

/** Next 16 的 NextRequest 无 .ip，IP 从代理 header 取。 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function isRateLimited(
  request: NextRequest,
  opts: { max?: number; windowMs?: number; feature?: string } = {}
): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const { max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS, feature = "global" } = opts;
  const ip = getClientIp(request);
  const key = `${feature}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  if (entry.count > max) return true;
  // 粗略清理过期条目，防止 Map 无限增长
  if (rateLimitStore.size > CLEANUP_THRESHOLD) {
    for (const [k, v] of rateLimitStore) {
      if (now >= v.resetAt) rateLimitStore.delete(k);
    }
  }
  return false;
}

/** 蜜罐字段被填 → 返回 true，调用方应静默"假装成功"。 */
export function isHoneypot(body: Record<string, unknown>): boolean {
  return Boolean(body.honeypot);
}

/** 安全解析 JSON body，解析失败返回 null。 */
export async function parseJsonBody(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
