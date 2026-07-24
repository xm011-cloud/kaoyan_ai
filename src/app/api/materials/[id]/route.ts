import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

// GET: 获取单个资料的所有内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;

    const material = await prisma.material.findFirst({
      where: { id, userId: user!.id },
      select: {
        id: true, name: true, type: true, size: true,
        url: true, content: true, createdAt: true, updatedAt: true,
      },
    });

    if (!material) {
      return NextResponse.json({ error: "资料不存在" }, { status: 404 });
    }

    return NextResponse.json({ material });
  } catch (err) {
    return handleApiError(err, "获取资料详情");
  }
}
