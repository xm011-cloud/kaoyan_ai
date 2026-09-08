import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

const SOURCE_TYPES = new Set(["manual", "external", "material"]);

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function optionalUrl(value: unknown) {
  const raw = text(value, 2000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id: courseId } = await params;
    const body = await request.json();
    const lessonTitle = text(body.lessonTitle, 120);
    const unitTitle = text(body.unitTitle, 120);
    const unitId = text(body.unitId, 80);
    const requestedType = text(body.sourceType, 20) || "manual";
    const sourceType = SOURCE_TYPES.has(requestedType) ? requestedType : "manual";
    const sourceUrl = optionalUrl(body.sourceUrl);
    const materialId = text(body.materialId, 80) || null;
    const plannedMinutes = Number.isInteger(body.plannedMinutes) && body.plannedMinutes > 0 && body.plannedMinutes <= 600
      ? body.plannedMinutes
      : null;

    if (!lessonTitle) return jsonNoStore({ error: "请填写课时名称" }, { status: 400 });
    if (body.sourceUrl && !sourceUrl) return jsonNoStore({ error: "课时链接格式不正确" }, { status: 400 });
    if (sourceType === "external" && !sourceUrl) {
      return jsonNoStore({ error: "外部课时需要填写可访问的课程链接" }, { status: 400 });
    }
    if (sourceType === "material" && !materialId) {
      return jsonNoStore({ error: "关联资料课时需要选择一份已有资料" }, { status: 400 });
    }

    const course = await prisma.course.findFirst({ where: { id: courseId, userId: user!.id } });
    if (!course) return jsonNoStore({ error: "课程不存在" }, { status: 404 });

    if (materialId) {
      const material = await prisma.material.findFirst({ where: { id: materialId, userId: user!.id }, select: { id: true } });
      if (!material) return jsonNoStore({ error: "关联资料不存在" }, { status: 400 });
    }

    const { unit, lesson } = await prisma.$transaction(async (tx) => {
      let targetUnit = unitId
        ? await tx.courseUnit.findFirst({ where: { id: unitId, courseId } })
        : null;
      if (unitId && !targetUnit) throw new Error("章节不属于这门课程");

      if (!targetUnit) {
        if (!unitTitle) throw new Error("请填写章节名称");
        const lastUnit = await tx.courseUnit.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
        targetUnit = await tx.courseUnit.create({
          data: { courseId, title: unitTitle, order: (lastUnit?.order ?? 0) + 1 },
        });
      }

      const lastLesson = await tx.courseLesson.findFirst({ where: { courseUnitId: targetUnit.id }, orderBy: { order: "desc" } });
      const createdLesson = await tx.courseLesson.create({
        data: {
          courseUnitId: targetUnit.id,
          title: lessonTitle,
          order: (lastLesson?.order ?? 0) + 1,
          sourceType,
          sourceUrl,
          materialId,
          plannedMinutes,
        },
        include: { material: { select: { id: true, name: true, type: true, url: true } } },
      });
      return { unit: targetUnit, lesson: createdLesson };
    });
    return jsonNoStore({ unit, lesson }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && ["章节不属于这门课程", "请填写章节名称"].includes(err.message)) {
      return jsonNoStore({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, "添加课时");
  }
}
