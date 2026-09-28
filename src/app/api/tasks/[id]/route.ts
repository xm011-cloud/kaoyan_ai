import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { resolveEvidenceLink, retractStudyEvidence, upsertStudyEvidence } from "@/lib/study-evidence";
import { CURRICULUM_OUTLINES } from "@/lib/curriculum-outlines";

function parseCurriculumNodeIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = Array.from(new Set(value.filter((id): id is string => typeof id === "string").slice(0, 8)));
  const known = new Set(CURRICULUM_OUTLINES.flatMap((outline) => outline.nodes.map((node) => node.id)));
  return ids.every((id) => known.has(id)) ? ids : null;
}

// GET: 供课程、练习等学习场景读取“从哪项计划进入”的最小上下文。
// 只返回当前用户自己的任务，避免客户端为了展示标题而拉取整周任务列表。
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user!.id },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        weekStartDate: true,
        milestoneId: true,
        milestone: { select: { title: true } },
      },
    });
    if (!task) return jsonNoStore({ error: "任务不存在" }, { status: 404 });
    return jsonNoStore({ task });
  } catch (err) {
    return handleApiError(err, "读取任务");
  }
}

// PATCH: 更新任务（切换完成状态等）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const curriculumNodeIds = body.curriculumNodeIds === undefined ? undefined : parseCurriculumNodeIds(body.curriculumNodeIds);
    if (curriculumNodeIds === null) return jsonNoStore({ error: "关联课程知识点不存在" }, { status: 400 });

    const task = await prisma.task.findFirst({
      where: { id, userId: user!.id },
    });
    if (!task) {
      return jsonNoStore({ error: "任务不存在" }, { status: 404 });
    }

    if (body.courseLessonId) {
      const lesson = await prisma.courseLesson.findFirst({
        where: { id: body.courseLessonId, unit: { course: { userId: user!.id } } },
        select: { id: true },
      });
      if (!lesson) return jsonNoStore({ error: "关联课时不存在" }, { status: 400 });
    }
    let milestoneId = task.milestoneId;
    const nextSubject = body.subject !== undefined ? body.subject : task.subject;
    if (body.milestoneId !== undefined) {
      if (body.milestoneId) {
        const resolved = await resolveEvidenceLink(prisma, user!.id, {
          milestoneId: body.milestoneId,
          subject: body.subject !== undefined ? body.subject : task.subject,
        });
        if (resolved.error) return jsonNoStore({ error: resolved.error }, { status: 400 });
        milestoneId = resolved.link?.milestoneId ?? null;
      } else {
        milestoneId = null;
      }
    }
    if (milestoneId) {
      const effectiveMilestone = await resolveEvidenceLink(prisma, user!.id, {
        milestoneId,
        subject: nextSubject,
      });
      if (effectiveMilestone.error) return jsonNoStore({ error: effectiveMilestone.error }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id },
        data: {
          ...(body.completed !== undefined && { completed: body.completed }),
          ...(body.title && { title: body.title }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.duration !== undefined && { duration: body.duration }),
          ...(body.phase !== undefined && { phase: body.phase }),
          ...(body.subject !== undefined && { subject: body.subject }),
          ...(body.date && { date: new Date(body.date) }),
          ...(body.courseLessonId !== undefined && { courseLessonId: body.courseLessonId || null }),
          ...(body.milestoneId !== undefined && { milestoneId }),
          ...(curriculumNodeIds !== undefined && { curriculumNodeIds }),
        },
      });
      if (next.completed) {
        await upsertStudyEvidence(tx, {
          userId: user!.id,
          taskId: next.id,
          milestoneId: next.milestoneId,
          kind: "task_completion",
          sourceId: next.id,
          title: next.title,
          subject: next.subject,
          occurredAt: task.completed ? task.updatedAt : new Date(),
          durationMinutes: next.duration,
          metadata: {
            date: next.date.toISOString(),
            weekStartDate: next.weekStartDate?.toISOString() ?? null,
          },
        });
      } else if (body.completed === false) {
        await retractStudyEvidence(tx, user!.id, "task_completion", next.id);
      }
      return next;
    }, { timeout: 30_000 });

    return jsonNoStore({ task: updated });
  } catch (err) {
    return handleApiError(err, "更新任务");
  }
}

// DELETE: 删除任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id, userId: user!.id },
    });
    if (!task) {
      return jsonNoStore({ error: "任务不存在" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除任务");
  }
}
