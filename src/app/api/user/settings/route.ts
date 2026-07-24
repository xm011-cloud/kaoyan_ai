import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

// GET: 获取用户 AI 配置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { aiKey: true, aiUrl: true, aiModel: true },
    });
    return NextResponse.json({
      hasKey: !!dbUser?.aiKey,
      aiUrl: dbUser?.aiUrl || "",
      aiModel: dbUser?.aiModel || "",
      keyHint: dbUser?.aiKey
        ? `${dbUser.aiKey.slice(0, 6)}...${dbUser.aiKey.slice(-4)}`
        : "",
    });
  } catch (err) {
    return handleApiError(err, "获取用户配置");
  }
}

// PUT: 保存用户 AI 配置
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { aiKey, aiUrl, aiModel } = body;

    if (!aiKey || aiKey.startsWith("sk-") === false) {
      return NextResponse.json(
        { error: "请输入有效的 API Key（以 sk- 开头）" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user!.id },
      data: { aiKey, aiUrl: aiUrl || null, aiModel: aiModel || null },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "保存用户配置");
  }
}

// DELETE: 移除用户 AI 配置
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    await prisma.user.update({
      where: { id: user!.id },
      data: { aiKey: null, aiUrl: null, aiModel: null },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "删除用户配置");
  }
}
