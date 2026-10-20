import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// 作者反馈收件箱：仅作者可见。匿名只影响未来可能的公开展示，不影响作者排查私有问题。
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const feedbacks = await prisma.authorFeedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
    return jsonNoStore({
      feedbacks: feedbacks.map((feedback) => ({
        ...feedback,
        createdAt: feedback.createdAt.toISOString(),
        updatedAt: feedback.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err, "获取反馈列表");
  }
}
