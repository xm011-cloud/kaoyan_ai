import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// PATCH: 更新技能（V1 只改 name/description/triggerKeywords，步骤编辑等工坊后补）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const skill = await prisma.skill.findFirst({ where: { id, userId: user!.id } });
    if (!skill) {
      return jsonNoStore({ error: "技能不存在" }, { status: 404 });
    }

    // 改名撞名（@@unique([userId, name])）→ 清晰的 409，而不是 500
    if (typeof body.name === "string" && body.name.trim() && body.name.trim() !== skill.name) {
      const dup = await prisma.skill.findFirst({
        where: { userId: user!.id, name: body.name.trim() },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        return jsonNoStore({ error: "已有同名技能，请换个名字" }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim().slice(0, 40);
    }
    if (typeof body.description === "string") {
      data.description = body.description.slice(0, 200) || null;
    }
    if (body.icon !== undefined) {
      data.icon = typeof body.icon === "string" && body.icon ? body.icon.slice(0, 8) : "⚡";
    }
    if (body.triggerKeywords !== undefined) {
      data.triggerKeywords = JSON.stringify(
        Array.isArray(body.triggerKeywords)
          ? body.triggerKeywords.filter((k: unknown) => typeof k === "string").slice(0, 20)
          : []
      );
    }

    const updated = await prisma.skill.update({ where: { id }, data });

    return jsonNoStore({
      skill: { id: updated.id, name: updated.name, description: updated.description, icon: updated.icon },
    });
  } catch (err) {
    return handleApiError(err, "更新技能");
  }
}

// DELETE: 删除技能（相关技能会话 Chat.skillId 留空，chat 路由按技能不存在回落为普通对话）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const skill = await prisma.skill.findFirst({ where: { id, userId: user!.id } });
    if (!skill) {
      return jsonNoStore({ error: "技能不存在" }, { status: 404 });
    }

    await prisma.skill.delete({ where: { id } });

    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除技能");
  }
}
