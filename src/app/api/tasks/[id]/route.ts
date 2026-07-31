import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// PATCH: 更新任务（切换完成状态等）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const task = await prisma.task.findFirst({
      where: { id, userId: user!.id },
    });
    if (!task) {
      return jsonNoStore({ error: "任务不存在" }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(body.completed !== undefined && { completed: body.completed }),
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.phase !== undefined && { phase: body.phase }),
        ...(body.date && { date: new Date(body.date) }),
      },
    });

    return jsonNoStore({ task: updated });
  } catch (err) {
    return handleApiError(err, "更新任务");
  }
}

// DELETE: 删除任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id, userId: user!.id },
    });
    if (!task) {
      return jsonNoStore({ error: "任务不存在" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除任务");
  }
}
