import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserWithRetry } from "@/lib/supabase/auth-retry";

const LOCAL_USER_CACHE_MS = 5 * 60_000;
const knownLocalUsers = new Map<string, { email: string; expiresAt: number }>();
const pendingLocalUsers = new Map<string, Promise<void>>();

export async function ensureLocalUser(userId: string, email?: string) {
  // Supabase Auth 与本地 User 表分离。过去每个私有 API 都执行 upsert，首页并发
  // 拉取时会对同一用户发起多次无意义 UPDATE，放大 Neon 冷连接和锁竞争。
  const resolvedEmail = email || `${userId}@unknown`;
  const now = Date.now();
  const cached = knownLocalUsers.get(userId);
  if (cached && cached.email === resolvedEmail && cached.expiresAt > now) return;

  const pending = pendingLocalUsers.get(userId);
  if (pending) return pending;

  // createMany + skipDuplicates 对重复调用幂等：新用户会被创建，已有用户不再被更新。
  // 邮箱的权威来源是 Supabase；本地副本无需在每一个 API 请求中同步。
  const operation = prisma.user.createMany({
    data: { id: userId, email: resolvedEmail },
    skipDuplicates: true,
  }).then(() => {
    knownLocalUsers.set(userId, { email: resolvedEmail, expiresAt: Date.now() + LOCAL_USER_CACHE_MS });
  }).finally(() => {
    pendingLocalUsers.delete(userId);
  });

  pendingLocalUsers.set(userId, operation);
  return operation;
}

export async function getAuthUser(request?: NextRequest) {
  // 先尝试 cookie 方式（浏览器流程）
  const supabase = await createClient();
  // E2E 已在 auth setup 取得真实 Supabase 会话。全套测试中每个私有 API 再请求一次
  // Auth 服务会放大外部网络波动；只在显式测试环境读取 cookie 内的 session，生产仍走
  // getUser() 的远程令牌校验，绝不把这个快捷路径带到真实请求。
  if (process.env.E2E_TEST_MODE === "1") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await ensureLocalUser(session.user.id, session.user.email);
      return { user: session.user, error: null };
    }
  }
  const {
    data: { user: cookieUser },
  } = await getAuthUserWithRetry(() => supabase.auth.getUser());

  if (cookieUser) {
    await ensureLocalUser(cookieUser.id, cookieUser.email);
    return { user: cookieUser, error: null };
  }

  // 再尝试 Bearer token（API 测试）
  const authHeader = request?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const serviceClient = createServiceClient();
    const {
      data: { user: tokenUser },
    } = await getAuthUserWithRetry(() => serviceClient.auth.getUser(token));

    if (tokenUser) {
      await ensureLocalUser(tokenUser.id, tokenUser.email);
      return { user: tokenUser, error: null };
    }
  }

  return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
