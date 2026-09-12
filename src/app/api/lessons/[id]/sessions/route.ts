import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id: lessonId } = await params;
    const body = await request.json().catch(() => ({}));
    const lesson = await prisma.courseLesson.findFirst({
      where: { id: lessonId, unit: { course: { userId: user!.id } } },
      select: { id: true },
    });
    if (!lesson) return jsonNoStore({ error: "课时不存在" }, { status: 404 });

    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId: user!.id },
        select: { id: true, courseLessonId: true },
      });
      if (!task) return jsonNoStore({ error: "关联任务不存在" }, { status: 400 });
      // 允许通用任务主动记录到某个课时，但不能把已绑定其他课时的任务挪作当前学习证据。
      if (task.courseLessonId && task.courseLessonId !== lessonId) {
        return jsonNoStore({ error: "关联任务不属于当前课时" }, { status: 400 });
      }
    }

    const existing = await prisma.studySession.findFirst({
      where: { userId: user!.id, courseLessonId: lessonId, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    });
    if (existing) return jsonNoStore({ session: existing, resumed: true });

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.studySession.create({ data: { userId: user!.id, courseLessonId: lessonId, taskId } });
      await tx.courseLesson.update({ where: { id: lessonId }, data: { status: "in_progress" } });
      return created;
    });
    return jsonNoStore({ session, resumed: false }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "开始学习会话");
  }
}
