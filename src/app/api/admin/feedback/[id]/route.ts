import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

const STATUSES = ["new", "read", "resolved"] as const;

// 管理后台：更新反馈状态（new → read → resolved）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    let status: unknown;
    try {
      ({ status } = await request.json());
    } catch {
      return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
    }
    if (typeof status !== "string" || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return jsonNoStore({ error: "无效的状态" }, { status: 400 });
    }

    const updated = await prisma.authorFeedback.update({
      where: { id },
      data: { status },
    });
    return jsonNoStore({ ok: true, feedback: updated });
  } catch (err) {
    return handleApiError(err, "更新反馈状态");
  }
}
