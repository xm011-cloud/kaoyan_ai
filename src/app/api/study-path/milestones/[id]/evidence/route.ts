import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getMilestoneEvidence } from "@/lib/milestone-evidence";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;
  try {
    const { id } = await context.params;
    const milestone = await prisma.studyPathMilestone.findFirst({ where: { id, studyPath: { userId: user!.id } } });
    if (!milestone) return jsonNoStore({ error: "里程碑不存在" }, { status: 404 });
    return jsonNoStore({ evidence: await getMilestoneEvidence(user!.id, milestone) });
  } catch (err) {
    return handleApiError(err, "获取里程碑证据");
  }
}
