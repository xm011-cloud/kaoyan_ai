import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

const NOTE_KINDS = new Set(["note", "question", "key_point", "error"]);

type Context = { params: Promise<{ id: string }> };

// PATCH: 只修改本人笔记的正文或分类；不改变它已关联的学习对象。
export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data: { content?: string; kind?: string } = {};
    if (typeof body.content === "string") {
      const content = body.content.trim().slice(0, 10_000);
      if (!content) return jsonNoStore({ error: "笔记内容不能为空" }, { status: 400 });
      data.content = content;
    }
    if (typeof body.kind === "string") {
      if (!NOTE_KINDS.has(body.kind)) return jsonNoStore({ error: "笔记分类无效" }, { status: 400 });
      data.kind = body.kind;
    }
    if (Object.keys(data).length === 0) return jsonNoStore({ error: "没有可更新的内容" }, { status: 400 });

    const result = await prisma.studyNote.updateMany({
      where: { id, userId: user!.id },
      data,
    });
    if (result.count === 0) return jsonNoStore({ error: "笔记不存在" }, { status: 404 });

    const note = await prisma.studyNote.findUniqueOrThrow({ where: { id } });
    return jsonNoStore({ note });
  } catch (err) {
    return handleApiError(err, "更新学习笔记");
  }
}
