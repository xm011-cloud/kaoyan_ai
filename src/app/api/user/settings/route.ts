import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取用户配置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        aiKey: true,
        aiUrl: true,
        aiModel: true,
        navPreferences: true,
        practicePreferences: true,
      },
    });
    return jsonNoStore({
      hasKey: !!dbUser?.aiKey,
      aiUrl: dbUser?.aiUrl || "",
      aiModel: dbUser?.aiModel || "",
      keyHint: dbUser?.aiKey
        ? `${dbUser.aiKey.slice(0, 6)}...${dbUser.aiKey.slice(-4)}`
        : "",
      navPreferences: dbUser?.navPreferences || null,
      practicePreferences: dbUser?.practicePreferences || null,
    });
  } catch (err) {
    return handleApiError(err, "获取用户配置");
  }
}

// PUT: 保存用户配置
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { aiKey, aiUrl, aiModel, navPreferences, practicePreferences } = body;

    // If AI key is provided, validate it
    if (aiKey && !aiKey.startsWith("sk-")) {
      return jsonNoStore(
        { error: "请输入有效的 API Key（以 sk- 开头）" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (aiKey !== undefined) data.aiKey = aiKey || null;
    if (aiUrl !== undefined) data.aiUrl = aiUrl || null;
    if (aiModel !== undefined) data.aiModel = aiModel || null;
    if (navPreferences !== undefined) data.navPreferences = navPreferences;
    if (practicePreferences !== undefined) data.practicePreferences = practicePreferences;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({
        where: { id: user!.id },
        data: data as Parameters<typeof prisma.user.update>[0]['data'],
      });
    }

    return jsonNoStore({ success: true });
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
    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除用户配置");
  }
}
