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

    const select = brief
      ? { id: true, name: true, type: true, size: true, url: true, createdAt: true }
      : { id: true, name: true, type: true, size: true, url: true, content: true, createdAt: true };

    const materials = await prisma.material.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      select,
    });

    return jsonNoStore({ materials });
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
