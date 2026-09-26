import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { CURRICULUM_OUTLINES } from "@/lib/curriculum-outlines";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, error } = await getAuthUser(request); if (error) return error;
  try {
    const { id } = await params; const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.curriculumNodeIds)) return jsonNoStore({ error: "请提供课程知识点" }, { status: 400 });
    const ids: string[] = Array.from(new Set<string>(body.curriculumNodeIds.filter((item: unknown): item is string => typeof item === "string").slice(0, 8)));
    const known = new Set(CURRICULUM_OUTLINES.flatMap((outline) => outline.nodes.map((node) => node.id)));
    if (ids.some((item) => !known.has(item))) return jsonNoStore({ error: "课程知识点不存在" }, { status: 400 });
    const result = await prisma.studyNote.updateMany({ where: { id, userId: user!.id }, data: { curriculumNodeIds: ids } });
    if (!result.count) return jsonNoStore({ error: "理解记录不存在" }, { status: 404 });
    const note = await prisma.studyNote.findUniqueOrThrow({ where: { id } }); return jsonNoStore({ note });
  } catch (err) { return handleApiError(err, "更新理解记录课程关联"); }
}
