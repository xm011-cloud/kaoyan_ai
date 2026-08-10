import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// 管理后台：审核通过/驳回（approved），或删除（垃圾留言）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    let approved: unknown;
    try {
      ({ approved } = await request.json());
    } catch {
      return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
    }
    if (typeof approved !== "boolean") {
      return jsonNoStore({ error: "无效的参数" }, { status: 400 });
    }

    const updated = await prisma.supporter.update({
      where: { id },
      data: { approved },
    });
    return jsonNoStore({ ok: true, supporter: updated });
  } catch (err) {
    return handleApiError(err, "审核留言");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.supporter.delete({ where: { id } });
    return jsonNoStore({ ok: true });
  } catch (err) {
    return handleApiError(err, "删除留言");
  }
}
