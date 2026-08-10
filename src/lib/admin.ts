import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";

/**
 * 管理后台鉴权：仅 ADMIN_EMAIL env 指定的账号可进入。
 * fail closed —— 未配置 ADMIN_EMAIL 时任何人都不是管理员（403）。
 * 返回 { user, error }，error 为可直接返回的 NextResponse。
 */
export async function requireAdmin(request?: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return { user: null, error };

  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!admin || user!.email?.toLowerCase() !== admin) {
    return {
      user: null,
      error: NextResponse.json({ error: "无权限" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
