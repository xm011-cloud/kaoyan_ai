import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// 计划页只需要为任务选择一个已存在的学习入口，不应为此加载每门课程的完整会话和笔记。
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const lessons = await prisma.courseLesson.findMany({
      where: { unit: { course: { userId: user!.id, status: { not: "archived" } } } },
      orderBy: [
        { unit: { course: { updatedAt: "desc" } } },
        { unit: { order: "asc" } },
        { order: "asc" },
      ],
      select: {
        id: true,
        title: true,
        unit: { select: { title: true, course: { select: { title: true, subject: true } } } },
      },
    });
    return jsonNoStore({
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        unitTitle: lesson.unit.title,
        courseTitle: lesson.unit.course.title,
        subject: lesson.unit.course.subject,
      })),
    });
  } catch (err) {
    return handleApiError(err, "获取可关联课时");
  }
}
