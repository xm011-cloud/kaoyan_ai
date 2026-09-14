import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { retractStudyEvidence, upsertStudyEvidence } from "@/lib/study-evidence";

const ASSESSMENTS = new Set(["clear", "needs_practice", "blocked"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const session = await prisma.studySession.findFirst({
      where: { id, userId: user!.id },
      include: {
        task: { select: { title: true, subject: true } },
        lesson: { select: { title: true, unit: { select: { course: { select: { subject: true } } } } } },
      },
    });
    if (!session) return jsonNoStore({ error: "学习会话不存在" }, { status: 404 });
    if (session.status !== "in_progress") {
      return jsonNoStore({ error: "这次学习会话已经结束，不能重复提交" }, { status: 409 });
    }

    const status = body.status === "completed" || body.status === "abandoned" ? body.status : null;
    const selfAssessment = typeof body.selfAssessment === "string" && ASSESSMENTS.has(body.selfAssessment)
      ? body.selfAssessment
      : null;
    const blocker = typeof body.blocker === "string" ? body.blocker.trim().slice(0, 1000) || null : undefined;
    const nextStep = typeof body.nextStep === "string" ? body.nextStep.trim().slice(0, 500) || null : undefined;
    const actualMinutes = Number.isInteger(body.actualMinutes) && body.actualMinutes >= 0 && body.actualMinutes <= 1440
      ? body.actualMinutes
      : null;

    if (!status || !selfAssessment) return jsonNoStore({ error: "请选择本次学习状态和自评" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.studySession.update({
        where: { id },
        data: { status, selfAssessment, blocker, nextStep, actualMinutes, endedAt: new Date() },
      });
      await tx.courseLesson.update({
        where: { id: session.courseLessonId },
        data: { status: status === "completed" ? "completed" : "in_progress" },
      });
      if (status === "completed") {
        await upsertStudyEvidence(tx, {
          userId: user!.id,
          taskId: session.taskId,
          milestoneId: session.milestoneId,
          kind: "course_session",
          sourceId: session.id,
          title: session.lesson.title,
          subject: session.task?.subject ?? session.lesson.unit.course.subject,
          occurredAt: next.endedAt ?? new Date(),
          durationMinutes: next.actualMinutes,
          metadata: {
            courseLessonId: session.courseLessonId,
            selfAssessment: next.selfAssessment,
            blocker: next.blocker,
            nextStep: next.nextStep,
          },
        });
      } else {
        await retractStudyEvidence(tx, user!.id, "course_session", session.id);
      }
      return next;
    });
    return jsonNoStore({ session: updated });
  } catch (err) {
    return handleApiError(err, "结束学习会话");
  }
}
