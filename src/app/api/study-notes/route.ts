import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { CURRICULUM_OUTLINES } from "@/lib/curriculum-outlines";

// 学习记录优先沉淀用户自己的理解和方法，而不是复述教材。
const NOTE_KINDS = new Set(["note", "question", "key_point", "error", "method"]);

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const searchParams = new URL(request.url).searchParams;
    const lessonId = searchParams.get("lessonId");
    const taskId = searchParams.get("taskId");
    const wrongQuestionId = searchParams.get("wrongQuestionId");
    const kind = searchParams.get("kind");
    const notes = await prisma.studyNote.findMany({
      where: {
        userId: user!.id,
        ...(lessonId ? { courseLessonId: lessonId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(wrongQuestionId ? { wrongQuestionId } : {}),
        ...(kind && NOTE_KINDS.has(kind) ? { kind } : {}),
      },
      include: {
        lesson: { select: { id: true, title: true, unit: { select: { title: true, course: { select: { title: true, subject: true } } } } } },
        task: { select: { id: true, title: true, subject: true } },
        wrongQuestion: { select: { id: true, subject: true, question: true, tags: true } },
        knowledgeLinks: { include: { node: { select: { id: true, name: true, subject: true, category: true } } } },
      },
      orderBy: { createdAt: "desc" },
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
    const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
    const kind = typeof body.kind === "string" && NOTE_KINDS.has(body.kind) ? body.kind : "note";
    const courseLessonId = typeof body.courseLessonId === "string" ? body.courseLessonId : null;
    const studySessionId = typeof body.studySessionId === "string" ? body.studySessionId : null;
    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    const wrongQuestionId = typeof body.wrongQuestionId === "string" ? body.wrongQuestionId : null;
    const requestedKnowledgeNodeIds: string[] = Array.isArray(body.knowledgeNodeIds)
      ? body.knowledgeNodeIds.filter((id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 8)
      : [];
    const knowledgeNodeIds = Array.from(new Set<string>(requestedKnowledgeNodeIds));
    const curriculumNodeIds = Array.from(new Set<string>(Array.isArray(body.curriculumNodeIds)
      ? body.curriculumNodeIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 8)
      : []));

    if (!content) return jsonNoStore({ error: "笔记内容不能为空" }, { status: 400 });
    if (!courseLessonId && !studySessionId && !taskId && !wrongQuestionId) {
      return jsonNoStore({ error: "记录需要关联课程、任务或错题" }, { status: 400 });
    }

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
    if (taskId) {
      const task = await prisma.task.findFirst({ where: { id: taskId, userId: user!.id }, select: { id: true } });
      if (!task) return jsonNoStore({ error: "任务不存在" }, { status: 400 });
    }
    if (wrongQuestionId) {
      const wrongQuestion = await prisma.wrongQuestion.findFirst({ where: { id: wrongQuestionId, userId: user!.id }, select: { id: true } });
      if (!wrongQuestion) return jsonNoStore({ error: "错题不存在" }, { status: 400 });
    }
    if (knowledgeNodeIds.length > 0) {
      const nodes = await prisma.knowledgeNode.findMany({ where: { id: { in: knowledgeNodeIds }, userId: user!.id }, select: { id: true } });
      if (nodes.length !== knowledgeNodeIds.length) return jsonNoStore({ error: "关联知识点不存在" }, { status: 400 });
    }
    const knownCurriculumNodeIds = new Set(CURRICULUM_OUTLINES.flatMap((outline) => outline.nodes.map((node) => node.id)));
    if (curriculumNodeIds.some((id) => !knownCurriculumNodeIds.has(id))) return jsonNoStore({ error: "关联课程知识点不存在" }, { status: 400 });

    // 离线重放使用客户端 UUID：同一请求即使被补传多次，也只保留一条笔记。
    if (id) {
      const existing = await prisma.studyNote.findUnique({ where: { id } });
      if (existing) {
        if (existing.userId !== user!.id) return jsonNoStore({ error: "笔记标识冲突" }, { status: 409 });
        return jsonNoStore({ note: existing });
      }
    }

    const note = await prisma.studyNote.create({
      data: {
        ...(id ? { id } : {}),
        userId: user!.id,
        content,
        kind,
        courseLessonId: lessonId,
        studySessionId,
        taskId,
        wrongQuestionId,
        knowledgeLinks: knowledgeNodeIds.length > 0
          ? { create: knowledgeNodeIds.map((nodeId) => ({ node: { connect: { id: nodeId } } })) }
          : undefined,
        curriculumNodeIds,
      },
    });
    return jsonNoStore({ note }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "保存学习笔记");
  }
}
