import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取用户 AI 配置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { aiKey: true, aiUrl: true, aiModel: true },
  });

  return NextResponse.json({
    hasKey: !!dbUser?.aiKey,
    aiUrl: dbUser?.aiUrl || "",
    aiModel: dbUser?.aiModel || "",
    // 返回脱敏后的 key 用于显示
    keyHint: dbUser?.aiKey
      ? `${dbUser.aiKey.slice(0, 6)}...${dbUser.aiKey.slice(-4)}`
      : "",
  });
}

// PUT: 保存用户 AI 配置
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

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
    data: {
      aiKey,
      aiUrl: aiUrl || null,
      aiModel: aiModel || null,
    },
  });

  return NextResponse.json({ success: true });
}

// DELETE: 移除用户 AI 配置
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  await prisma.user.update({
    where: { id: user!.id },
    data: { aiKey: null, aiUrl: null, aiModel: null },
  });

  return NextResponse.json({ success: true });
}
