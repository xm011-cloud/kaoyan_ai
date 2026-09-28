import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { getCurriculumNode } from "@/lib/curriculum-outlines";
import { withDatabaseReadRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ nodeId: string }> };

// 详情只统计用户已确认写入的关联；不从笔记文本、题目标题或 AI 输出中猜测归属。
export async function GET(_request: NextRequest, { params }: Context) {
  const { user, error } = await getAuthUser(_request);
  if (error) return error;

  try {
    const { nodeId } = await params;
    const found = getCurriculumNode(nodeId);
    if (!found) return jsonNoStore({ error: "课程知识点不存在" }, { status: 404 });

    const [notes, totalNotes, dueNotes, tasks, taskCount] = await withDatabaseReadRetry(() => Promise.all([
      prisma.studyNote.findMany({
        where: { userId: user!.id, curriculumNodeIds: { has: nodeId } },
        include: {
          lesson: { select: { id: true, title: true, unit: { select: { course: { select: { title: true } } } } } },
          task: { select: { id: true, title: true, subject: true, completed: true, date: true } },
          wrongQuestion: { select: { id: true, subject: true, question: true, reviewed: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.studyNote.count({ where: { userId: user!.id, curriculumNodeIds: { has: nodeId } } }),
      prisma.studyNote.count({
        where: { userId: user!.id, curriculumNodeIds: { has: nodeId }, nextReviewAt: { lte: new Date() } },
      }),
      prisma.task.findMany({
        where: { userId: user!.id, curriculumNodeIds: { has: nodeId } },
        select: { id: true, title: true, date: true, completed: true, duration: true, milestone: { select: { title: true } } },
        orderBy: [{ completed: "asc" }, { date: "asc" }],
        take: 12,
      }),
      // 列表只展示近期的 12 项，摘要数字仍必须反映所有已确认关联的任务。
      prisma.task.count({ where: { userId: user!.id, curriculumNodeIds: { has: nodeId } } }),
    ]));

    const taskSourceCount = new Set(notes.flatMap((note) => note.task ? [note.task.id] : [])).size;
    const wrongQuestionSourceCount = new Set(notes.flatMap((note) => note.wrongQuestion ? [note.wrongQuestion.id] : [])).size;
    const lessonSourceCount = new Set(notes.flatMap((note) => note.lesson ? [note.lesson.id] : [])).size;
    const prerequisites = found.node.prerequisites
      .map((id) => found.outline.nodes.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const dependents = found.outline.nodes.filter((item) => item.prerequisites.includes(nodeId));

    return jsonNoStore({
      outline: { id: found.outline.id, subject: found.outline.subject, version: found.outline.version, label: found.outline.label },
      node: found.node,
      prerequisites,
      dependents,
      notes,
      tasks: tasks.map(({ milestone, ...task }) => ({ ...task, milestoneTitle: milestone?.title ?? null })),
      evidence: { totalNotes, dueNotes, taskCount, taskSourceCount, wrongQuestionSourceCount, lessonSourceCount },
    });
  } catch (err) {
    return handleApiError(err, "获取课程知识点详情");
  }
}
