import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取资料列表
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const brief = searchParams.get("brief");

    // 资料不是孤立的文件：把它已经接入的课程课时和任务一起投影出来。
    // 这是既有 Course / CourseLesson / Task 关系的只读聚合，不新增资源表或迁移历史数据。
    const select = {
      id: true,
      name: true,
      type: true,
      size: true,
      url: true,
      createdAt: true,
      ...(brief ? {} : { content: true }),
      courseLessons: {
        where: { unit: { course: { userId: user!.id } } },
        select: {
          id: true,
          title: true,
          status: true,
          unit: { select: { course: { select: { id: true, title: true, subject: true } } } },
          tasks: {
            where: { userId: user!.id },
            orderBy: [{ completed: "asc" as const }, { date: "asc" as const }],
            select: { id: true, title: true, weekStartDate: true },
            take: 1,
          },
        },
      },
    };

    const materials = await prisma.material.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      select,
    });

    return jsonNoStore({
      materials: materials.map(({ courseLessons, ...material }) => ({
        ...material,
        resourceLinks: courseLessons.map((lesson) => ({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonStatus: lesson.status,
          courseId: lesson.unit.course.id,
          courseTitle: lesson.unit.course.title,
          subject: lesson.unit.course.subject,
          task: lesson.tasks[0]
            ? {
                id: lesson.tasks[0].id,
                title: lesson.tasks[0].title,
                weekStartDate: lesson.tasks[0].weekStartDate,
              }
            : null,
        })),
      })),
    });
  } catch (err) {
    return handleApiError(err, "获取资料列表");
  }
}

// POST: 创建资料记录（文件上传由 Supabase Storage 处理）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { name, type, url, size } = body;

    if (!name || !type || !url || !size) {
      return jsonNoStore({ error: "缺少必要参数" }, { status: 400 });
    }

    const material = await prisma.material.create({
      data: { userId: user!.id, name, type, url, size },
    });

    return jsonNoStore({ material });
  } catch (err) {
    return handleApiError(err, "创建资料");
  }
}

// DELETE: 删除资料
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return jsonNoStore({ error: "缺少资料 ID" }, { status: 400 });
    }

    const material = await prisma.material.findFirst({
      where: { id, userId: user!.id },
    });
    if (!material) {
      return jsonNoStore({ error: "资料不存在" }, { status: 404 });
    }

    await prisma.material.delete({ where: { id } });
    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除资料");
  }
}
