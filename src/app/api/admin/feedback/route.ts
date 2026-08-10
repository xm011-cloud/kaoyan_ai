import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// 管理后台：意见反馈列表（email 作者可见，不受 anonymous 影响）
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const feedbacks = await prisma.authorFeedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
    return jsonNoStore({ feedbacks });
  } catch (err) {
    return handleApiError(err, "获取反馈列表");
  }
}
