import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

const NOTE_KINDS = new Set(["note", "question", "key_point", "error"]);

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const lessonId = new URL(request.url).searchParams.get("lessonId");
    const notes = await prisma.studyNote.findMany({
      where: { userId: user!.id, ...(lessonId ? { courseLessonId: lessonId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return jsonNoStore({ notes });
  } catch (err) {
    return handleApiError(err, "获取学习笔记");
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 10000) : "";
    const kind = typeof body.kind === "string" && NOTE_KINDS.has(body.kind) ? body.kind : "note";
    const courseLessonId = typeof body.courseLessonId === "string" ? body.courseLessonId : null;
    const studySessionId = typeof body.studySessionId === "string" ? body.studySessionId : null;

    if (!content) return jsonNoStore({ error: "笔记内容不能为空" }, { status: 400 });
    if (!courseLessonId && !studySessionId) return jsonNoStore({ error: "笔记需要关联一节课程或一次学习会话" }, { status: 400 });

    let lessonId = courseLessonId;
    if (studySessionId) {
      const session = await prisma.studySession.findFirst({ where: { id: studySessionId, userId: user!.id } });
      if (!session) return jsonNoStore({ error: "学习会话不存在" }, { status: 400 });
      if (lessonId && lessonId !== session.courseLessonId) return jsonNoStore({ error: "笔记关联不一致" }, { status: 400 });
      lessonId = session.courseLessonId;
    }
    if (lessonId) {
      const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, unit: { course: { userId: user!.id } } }, select: { id: true } });
      if (!lesson) return jsonNoStore({ error: "课时不存在" }, { status: 400 });
    }

    const note = await prisma.studyNote.create({ data: { userId: user!.id, content, kind, courseLessonId: lessonId, studySessionId } });
    return jsonNoStore({ note }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "保存学习笔记");
  }
}
