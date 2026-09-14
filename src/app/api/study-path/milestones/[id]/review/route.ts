import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getMilestoneEvidence } from "@/lib/milestone-evidence";

const OUTCOMES = new Set(["achieved", "continue", "relearn"]);

/** 用户复盘后才更新里程碑；证据达标只会触发建议，绝不自动完成。 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const outcome = typeof body.outcome === "string" ? body.outcome : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    if (!OUTCOMES.has(outcome)) return jsonNoStore({ error: "请选择复盘结论" }, { status: 400 });

    const milestone = await prisma.studyPathMilestone.findFirst({
      where: { id, studyPath: { userId: user!.id, status: "active" } },
    });
    if (!milestone) return jsonNoStore({ error: "当前路线中没有这个里程碑" }, { status: 404 });

    // 复盘结论是用户的明确操作，证据汇总仅用于回显；汇总的瞬时读取失败
    // 不应阻止用户保存“已达成/继续巩固/需要重学”的判断。
    let evidence: Awaited<ReturnType<typeof getMilestoneEvidence>> | null = null;
    try {
      evidence = await getMilestoneEvidence(user!.id, milestone);
    } catch (e) {
      console.warn("Milestone evidence summary unavailable during review:", e);
    }
    const data = outcome === "achieved"
      ? { progress: 1, completedAt: new Date(), reviewedAt: new Date(), reviewOutcome: outcome, reviewNote: note || null }
      : outcome === "relearn"
        ? { progress: Math.min(milestone.progress, 0.25), completedAt: null, reviewedAt: new Date(), reviewOutcome: outcome, reviewNote: note || null }
        : { completedAt: null, reviewedAt: new Date(), reviewOutcome: outcome, reviewNote: note || null };
    const updated = await prisma.studyPathMilestone.update({ where: { id }, data });
    return jsonNoStore({ milestone: updated, evidence });
  } catch (err) {
    return handleApiError(err, "确认里程碑复盘");
  }
}
