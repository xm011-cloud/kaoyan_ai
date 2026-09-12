import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getMilestoneEvidence } from "@/lib/milestone-evidence";

/** 批量读取当前屏幕所需的里程碑证据，避免周计划为每项任务各发一次网络请求。 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const ids = [...new Set((new URL(request.url).searchParams.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean))]
      .slice(0, 24);
    if (ids.length === 0) return jsonNoStore({ evidence: {} });

    const milestones = await prisma.studyPathMilestone.findMany({
      where: { id: { in: ids }, studyPath: { userId: user!.id } },
      select: { id: true, subject: true, createdAt: true, progress: true, completedAt: true },
    });
    const evidence = await Promise.all(milestones.map(async (milestone) => [
      milestone.id,
      await getMilestoneEvidence(user!.id, milestone),
    ] as const));
    return jsonNoStore({ evidence: Object.fromEntries(evidence) });
  } catch (err) {
    return handleApiError(err, "批量获取里程碑证据");
  }
}
