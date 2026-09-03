import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PATCH: 更新里程碑进度
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { milestoneId, progress, completed } = body;

    if (!milestoneId) {
      return jsonNoStore({ error: "缺少里程碑ID" }, { status: 400 });
    }

    const milestone = await prisma.studyPathMilestone.findUnique({
      where: { id: milestoneId },
      include: { studyPath: true },
    });

    if (!milestone || milestone.studyPath.userId !== user!.id) {
      return jsonNoStore({ error: "里程碑不存在" }, { status: 404 });
    }
    if (milestone.studyPath.status !== "active") {
      return jsonNoStore({ error: "只能更新当前已激活路线的进度" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (progress !== undefined) data.progress = Math.min(1, Math.max(0, progress));
    if (completed) {
      data.completedAt = new Date();
      data.progress = 1.0;
    }

    const updated = await prisma.studyPathMilestone.update({
      where: { id: milestoneId },
      data,
    });

    return jsonNoStore({ milestone: updated });
  } catch (err) {
    console.error("Update milestone progress error:", err);
    return jsonNoStore({ error: "更新进度失败" }, { status: 500 });
  }
}
