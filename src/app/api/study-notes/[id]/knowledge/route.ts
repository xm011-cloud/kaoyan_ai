import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

type Context = { params: Promise<{ id: string }> };

// 用户确认后才替换一张理解卡的知识点归属；不通过标题、科目或模型输出猜测关联。
export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.knowledgeNodeIds)) return jsonNoStore({ error: "请提供知识点关联" }, { status: 400 });
    const requestedNodeIds: string[] = body.knowledgeNodeIds
      .filter((nodeId: unknown): nodeId is string => typeof nodeId === "string" && /^[0-9a-f-]{36}$/i.test(nodeId))
      .slice(0, 8);
    const nodeIds = Array.from(new Set<string>(requestedNodeIds));

    const note = await prisma.studyNote.findFirst({ where: { id, userId: user!.id }, select: { id: true } });
    if (!note) return jsonNoStore({ error: "理解记录不存在" }, { status: 404 });
    if (nodeIds.length > 0) {
      const nodes = await prisma.knowledgeNode.findMany({ where: { id: { in: nodeIds }, userId: user!.id }, select: { id: true } });
      if (nodes.length !== nodeIds.length) return jsonNoStore({ error: "存在无权访问的知识点" }, { status: 400 });
    }

    const updated = await prisma.studyNote.update({
      where: { id },
      data: {
        knowledgeLinks: {
          deleteMany: {},
          create: nodeIds.map((nodeId) => ({ node: { connect: { id: nodeId } } })),
        },
      },
      include: { knowledgeLinks: { include: { node: { select: { id: true, name: true, subject: true, category: true } } } } },
    });
    return jsonNoStore({ note: updated });
  } catch (err) {
    return handleApiError(err, "更新理解记录知识点关联");
  }
}
