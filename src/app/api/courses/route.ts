import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { normalizeExternalUrl } from "@/lib/external-url";

const SOURCE_TYPES = new Set(["manual", "external", "material"]);

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

// 课程列表只返回轻量概览；课时和笔记由课程详情按需读取。
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const lessonId = new URL(request.url).searchParams.get("lesson");
    const courses = await prisma.course.findMany({
      where: { userId: user!.id, status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
      include: {
        units: { select: { _count: { select: { lessons: true } } } },
      },
    });
    const selectedCourseId = lessonId
      ? (await prisma.courseLesson.findFirst({
          where: { id: lessonId, unit: { course: { userId: user!.id } } },
          select: { unit: { select: { courseId: true } } },
        }))?.unit.courseId ?? null
      : null;
    return jsonNoStore({
      courses: courses.map(({ units, ...course }) => ({
        ...course,
        lessonCount: units.reduce((total, unit) => total + unit._count.lessons, 0),
      })),
      selectedCourseId,
    });
  } catch (err) {
    return handleApiError(err, "获取课程列表");
  }
}

// 创建一门课程时可顺手创建第一节课，避免用户面对空课程。
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const title = readText(body.title, 120);
    const subject = readText(body.subject, 60) || null;
    const description = readText(body.description, 1000) || null;
    const firstLessonTitle = readText(body.firstLessonTitle, 120);
    const requestedType = readText(body.sourceType, 20) || "manual";
    const materialId = readText(body.materialId, 120) || null;
    const material = materialId
      ? await prisma.material.findFirst({
          where: { id: materialId, userId: user!.id },
          select: { id: true, name: true },
        })
      : null;
    if (materialId && !material) return jsonNoStore({ error: "关联资料不存在" }, { status: 400 });

    // 资料关联优先于调用方传来的类型，避免把其他用户的附件或一个无效 URL
    // 伪装成当前用户可学习的课时。
    const sourceType = material ? "material" : SOURCE_TYPES.has(requestedType) ? requestedType : "manual";
    // 附件是唯一学习来源时不读取额外链接，避免一个无关的旧输入阻断“资料放进课程”。
    const sourceUrl = material ? null : normalizeExternalUrl(body.sourceUrl);
    const resolvedLessonTitle = firstLessonTitle || material?.name || "";

    if (!title) return jsonNoStore({ error: "请填写课程名称" }, { status: 400 });
    if (!material && body.sourceUrl && !sourceUrl) return jsonNoStore({ error: "课程链接格式不正确" }, { status: 400 });

    const course = await prisma.course.create({
      data: {
        userId: user!.id,
        title,
        subject,
        description,
        sourceType,
        sourceUrl: material ? null : sourceUrl,
        ...(resolvedLessonTitle && {
          units: {
            create: {
              title: "开始学习",
              order: 1,
              lessons: {
                create: {
                  title: resolvedLessonTitle,
                  order: 1,
                  sourceType,
                  sourceUrl: material ? null : sourceUrl,
                  materialId: material?.id,
                },
              },
            },
          },
        }),
      },
      include: { units: { include: { lessons: true } } },
    });

    return jsonNoStore({ course }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "创建课程");
  }
}
