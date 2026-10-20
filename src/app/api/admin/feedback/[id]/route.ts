import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

const STATUSES = ["new", "triaged", "planned", "released", "closed", "read", "resolved"] as const;

// 管理后台：更新产品反馈分诊信息。旧 read/resolved 状态继续可读可写。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
    }
    const status = body.status;
    if (typeof status !== "string" || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return jsonNoStore({ error: "无效的状态" }, { status: 400 });
    }
    const authorNote = typeof body.authorNote === "string" ? body.authorNote.trim().slice(0, 2000) : null;
    const releaseVersion = typeof body.releaseVersion === "string" ? body.releaseVersion.trim().slice(0, 100) : null;

    const updated = await prisma.authorFeedback.update({
      where: { id },
      data: { status, authorNote: authorNote || null, releaseVersion: releaseVersion || null },
    });
    return jsonNoStore({ ok: true, feedback: updated });
  } catch (err) {
    return handleApiError(err, "更新反馈状态");
  }
}
