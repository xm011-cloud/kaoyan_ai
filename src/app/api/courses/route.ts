import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

const SOURCE_TYPES = new Set(["manual", "external", "material"]);

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function readUrl(value: unknown) {
  const url = readText(value, 2000);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// 课程列表只返回轻量概览；课时和笔记由课程详情按需读取。
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const courses = await prisma.course.findMany({
      where: { userId: user!.id, status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
      include: {
        units: { select: { _count: { select: { lessons: true } } } },
      },
    });
    return jsonNoStore({
      courses: courses.map(({ units, ...course }) => ({
        ...course,
        lessonCount: units.reduce((total, unit) => total + unit._count.lessons, 0),
      })),
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
    const sourceType = SOURCE_TYPES.has(requestedType) ? requestedType : "manual";
    const sourceUrl = readUrl(body.sourceUrl);

    if (!title) return jsonNoStore({ error: "请填写课程名称" }, { status: 400 });
    if (body.sourceUrl && !sourceUrl) return jsonNoStore({ error: "课程链接格式不正确" }, { status: 400 });

    const course = await prisma.course.create({
      data: {
        userId: user!.id,
        title,
        subject,
        description,
        sourceType,
        sourceUrl,
        ...(firstLessonTitle && {
          units: {
            create: {
              title: "开始学习",
              order: 1,
              lessons: {
                create: {
                  title: firstLessonTitle,
                  order: 1,
                  sourceType,
                  sourceUrl,
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
