import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { getMilestone } from "@/lib/milestone";

// GET: 获取反馈列表
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: user!.id },
      orderBy: { weekStart: "desc" },
      take: 10,
    });

    const milestone = await getMilestone(user!.id);

    return jsonNoStore({ feedbacks, milestone });
  } catch (err) {
    return handleApiError(err, "获取反馈列表");
  }
}

// PATCH: 保存用户对本周执行偏差的解释。这里只记录复盘，不会直接改任务或路线。
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const reasons = Array.isArray(body.reasons)
      ? body.reasons.filter((item: unknown): item is string => typeof item === "string").slice(0, 5)
      : [];
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const scope = body.scope === "stage" ? "stage" : "weekly";
    if (!id) return jsonNoStore({ error: "缺少周报标识" }, { status: 400 });
    if (reasons.length === 0 && !note) {
      return jsonNoStore({ error: "请至少说明一个原因或补充情况" }, { status: 400 });
    }

    const result = await prisma.feedback.updateMany({
      where: { id, userId: user!.id },
      data: {
        review: {
          reasons,
          note: note || null,
          scope,
          submittedAt: new Date().toISOString(),
        },
      },
    });
    if (result.count === 0) return jsonNoStore({ error: "未找到这份周报" }, { status: 404 });

    const feedback = await prisma.feedback.findUniqueOrThrow({ where: { id } });
    return jsonNoStore({ feedback });
  } catch (err) {
    return handleApiError(err, "保存周复盘");
  }
}
