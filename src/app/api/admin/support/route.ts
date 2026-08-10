import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// 管理后台：全部支持留言（未审核在前）
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const supporters = await prisma.supporter.findMany({
      orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
      include: { user: { select: { email: true } } },
    });
    return jsonNoStore({ supporters });
  } catch (err) {
    return handleApiError(err, "获取留言列表");
  }
}
