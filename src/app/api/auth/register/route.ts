import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { jsonNoStore } from "@/lib/api-utils";
import { ensureLocalUser } from "@/lib/api-auth";

// 注册限流：按 IP 5 次/分钟（仅生产环境生效，避免 dev/Playwright 自限流）。
// 注：serverless 多实例下为 per-instance 计数，属低成本威慑，非强保证。
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

/** 恒定时间字符串比较：先 sha256 到固定 32 字节，避免长度与时序泄露。 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Next 16 的 NextRequest 无 .ip，IP 从代理 header 取。 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  // 粗略清理过期条目，防止 Map 无限增长
  if (rateLimits.size > 1000) {
    for (const [k, v] of rateLimits) {
      if (now >= v.resetAt) rateLimits.delete(k);
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    inviteCode?: string;
    honeypot?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
  }

  // 1. 蜜罐字段被填 → 假装成功，浪费机器人时间
  if (body.honeypot) return jsonNoStore({ ok: true });

  // 2. 限流
  if (isRateLimited(getClientIp(request))) {
    return jsonNoStore({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const inviteCode = body.inviteCode ?? "";

  // 3. 格式校验
  if (!email || !password) {
    return jsonNoStore({ error: "请填写邮箱和密码" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonNoStore({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (password.length < 6) {
    return jsonNoStore({ error: "密码至少 6 位" }, { status: 400 });
  }

  // 4. 邀请码校验（默认关闭 = 安全兜底）
  const expected = process.env.REGISTER_INVITE_CODE ?? "";
  if (!expected) {
    return jsonNoStore({ error: "注册已关闭，请联系管理员" }, { status: 403 });
  }
  if (!timingSafeEqualStr(inviteCode, expected)) {
    return jsonNoStore({ error: "邀请码错误" }, { status: 403 });
  }

  // 5. admin.createUser：service_role 绕过公开注册开关，email_confirm 标记已确认（不发邮件）
  try {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.status === 422 || /already been registered/i.test(error.message)) {
        return jsonNoStore({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
      }
      console.error("[API] register createUser:", error.message);
      return jsonNoStore({ error: "注册失败，请稍后再试" }, { status: 500 });
    }

    const user = data.user;
    if (!user) {
      return jsonNoStore({ error: "注册失败，请稍后再试" }, { status: 500 });
    }

    // 6. 同步本地 Prisma User，保证 dashboard 首次渲染不依赖懒同步
    await ensureLocalUser(user.id, user.email ?? undefined);
    return jsonNoStore({ ok: true });
  } catch (err) {
    console.error(
      "[API] register:",
      err instanceof Error ? err.message : String(err)
    );
    return jsonNoStore({ error: "注册失败，请稍后再试" }, { status: 500 });
  }
}
