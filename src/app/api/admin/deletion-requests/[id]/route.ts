import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// GET: 待处理/已处理的注销请求列表
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const requests = await prisma.deletionRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return jsonNoStore({
      requests: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.email,
        status: r.status,
        createdAt: r.createdAt,
        handledAt: r.handledAt,
      })),
    });
  } catch (err) {
    return handleApiError(err, "获取注销请求");
  }
}

// PATCH: 标记处理完成（作者在 Supabase 控制台删除 auth 用户 + 本地数据后标记）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    const record = await prisma.deletionRequest.findUnique({ where: { id } });
    if (!record) {
      return jsonNoStore({ error: "请求不存在" }, { status: 404 });
    }
    const updated = await prisma.deletionRequest.update({
      where: { id },
      data: { status: "done", handledAt: new Date() },
    });
    return jsonNoStore({ ok: true, record: updated });
  } catch (err) {
    return handleApiError(err, "处理注销请求");
  }
}
