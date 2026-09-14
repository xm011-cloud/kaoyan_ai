import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { resolveEvidenceLink } from "@/lib/study-evidence";

function metadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

/** 最近的未归属学习事实。它们不会影响任何里程碑，直到用户明确选择归属。 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 20, 1), 50);
    const evidence = await prisma.studyEvidence.findMany({
      where: { userId: user!.id, milestoneId: null, status: "active" },
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: {
        id: true,
        taskId: true,
        kind: true,
        title: true,
        subject: true,
        occurredAt: true,
        durationMinutes: true,
        score: true,
        maxScore: true,
      },
    });
    return jsonNoStore({ evidence });
  } catch (err) {
    return handleApiError(err, "获取待归属学习证据");
  }
}

/** 用户显式选择归属；同时回写来源对象，使后续行为沿同一任务/里程碑继续累计。 */
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const evidenceId = typeof body.evidenceId === "string" ? body.evidenceId : "";
    const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : "";
    const requestedTaskId = typeof body.taskId === "string" ? body.taskId : null;
    if (!evidenceId || !milestoneId) return jsonNoStore({ error: "请选择学习证据和里程碑" }, { status: 400 });

    const evidence = await prisma.studyEvidence.findFirst({
      where: { id: evidenceId, userId: user!.id, status: "active", milestoneId: null },
    });
    if (!evidence) return jsonNoStore({ error: "学习证据不存在" }, { status: 404 });
    const resolved = await resolveEvidenceLink(prisma, user!.id, {
      taskId: requestedTaskId ?? evidence.taskId,
      milestoneId,
      subject: evidence.subject,
    });
    if (resolved.error) return jsonNoStore({ error: resolved.error }, { status: 400 });
    if (!resolved.link?.milestoneId) return jsonNoStore({ error: "里程碑归属无效" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      // 条件更新让两个并发页面无法互相覆盖：只有第一位确认者能认领这条待归属记录。
      const claimed = await tx.studyEvidence.updateMany({
        where: { id: evidence.id, userId: user!.id, status: "active", milestoneId: null },
        data: { milestoneId: resolved.link!.milestoneId, taskId: resolved.link!.taskId },
      });
      if (claimed.count !== 1) return null;
      if (evidence.kind === "task_completion" && resolved.link?.taskId) {
        await tx.task.update({ where: { id: resolved.link.taskId }, data: { milestoneId: resolved.link.milestoneId } });
      } else if (evidence.kind === "course_session") {
        await tx.studySession.updateMany({
          where: { id: evidence.sourceId, userId: user!.id },
          data: { milestoneId: resolved.link?.milestoneId, taskId: resolved.link?.taskId },
        });
      } else if (evidence.kind === "practice_session") {
        await tx.practiceSession.updateMany({
          where: { id: evidence.sourceId, userId: user!.id },
          data: { milestoneId: resolved.link?.milestoneId, taskId: resolved.link?.taskId },
        });
      } else if (evidence.kind === "wrong_review") {
        const wrongQuestionId = metadataString(evidence.metadata, "wrongQuestionId");
        if (wrongQuestionId) {
          await tx.wrongQuestion.updateMany({
            where: { id: wrongQuestionId, userId: user!.id },
            data: { milestoneId: resolved.link?.milestoneId, taskId: resolved.link?.taskId },
          });
        }
      }
      return tx.studyEvidence.findUniqueOrThrow({ where: { id: evidence.id } });
    });
    if (!updated) return jsonNoStore({ error: "这条学习记录已在其他页面完成归属，请刷新后查看" }, { status: 409 });
    return jsonNoStore({ evidence: updated });
  } catch (err) {
    return handleApiError(err, "归属学习证据");
  }
}
