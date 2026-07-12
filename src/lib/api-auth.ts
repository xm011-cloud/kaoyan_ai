import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function ensureLocalUser(userId: string, email?: string) {
  // 确保本地 User 表有这条记录（Supabase Auth 和本地 DB 分离）
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: email || `${userId}@unknown` },
    update: { email: email || undefined },
  });
}

export async function getAuthUser(request?: NextRequest) {
  // 先尝试 cookie 方式（浏览器流程）
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

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
    } = await serviceClient.auth.getUser(token);

    if (tokenUser) {
      await ensureLocalUser(tokenUser.id, tokenUser.email);
      return { user: tokenUser, error: null };
    }
  }

  return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
