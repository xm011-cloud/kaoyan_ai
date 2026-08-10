import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

// 管理后台：为指定邮箱生成密码重置链接（跨浏览器可靠通道）。
// PKCE 下 generateLink 返回的 action_link 走 /auth/v1/verify 需浏览器持有 verifier，
// 必然失败 —— 改用 hashed_token 自建链接：/auth/callback?token_hash=…&type=recovery
// （verifyOtp 免 verifier，任何浏览器/无痕均可用）。不传 redirectTo，避免 redirect allowlist 依赖。
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    let email: unknown;
    try {
      ({ email } = await request.json());
    } catch {
      return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonNoStore({ error: "邮箱格式不正确" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error: linkError } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkError || !data.user || !data.properties.hashed_token) {
      // 该邮箱不是注册用户（或 Supabase 侧失败）
      return jsonNoStore({ error: "该邮箱不是注册用户" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const resetLink = `${origin}/auth/callback?token_hash=${encodeURIComponent(
      data.properties.hashed_token
    )}&type=recovery`;

    return jsonNoStore({ ok: true, resetLink });
  } catch (err) {
    return handleApiError(err, "生成重置链接");
  }
}
