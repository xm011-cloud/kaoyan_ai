import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// DELETE: 删除知识点
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const node = await prisma.knowledgeNode.findUnique({ where: { id } });

    if (!node || node.userId !== user!.id) {
      return NextResponse.json({ error: "知识点不存在" }, { status: 404 });
    }

    // Cascade will delete associated edges
    await prisma.knowledgeNode.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete knowledge-node error:", err);
    return NextResponse.json({ error: "删除知识点失败" }, { status: 500 });
  }
}
