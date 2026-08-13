import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取用户配置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    // AI 生成的任务数（供驾驶模式"过渡摘要"提示，切档时说明不会被静默改动）
    // 与用户信息并行查询，避免串行增加首屏延迟
    const [dbUser, aiTaskCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user!.id },
        select: {
          aiKey: true,
          aiUrl: true,
          aiModel: true,
          drivingMode: true,
          navPreferences: true,
          practicePreferences: true,
        },
      }),
      prisma.task.count({
        where: { userId: user!.id, source: { not: "manual" } },
      }),
    ]);
    return jsonNoStore({
      hasKey: !!dbUser?.aiKey,
      aiUrl: dbUser?.aiUrl || "",
      aiModel: dbUser?.aiModel || "",
      drivingMode: dbUser?.drivingMode || "assisted",
      aiTaskCount,
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
    const { aiKey, aiUrl, aiModel, drivingMode, navPreferences, practicePreferences } = body;

    // If AI key is provided, validate it
    if (aiKey && !aiKey.startsWith("sk-")) {
      return jsonNoStore(
        { error: "请输入有效的 API Key（以 sk- 开头）" },
        { status: 400 }
      );
    }

    // 驾驶模式取值校验
    if (drivingMode !== undefined && !["auto", "assisted", "manual"].includes(drivingMode)) {
      return jsonNoStore({ error: "无效的驾驶模式" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (aiKey !== undefined) data.aiKey = aiKey || null;
    if (aiUrl !== undefined) data.aiUrl = aiUrl || null;
    if (aiModel !== undefined) data.aiModel = aiModel || null;
    if (drivingMode !== undefined) data.drivingMode = drivingMode;
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
