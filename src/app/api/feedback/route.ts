import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

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

    return jsonNoStore({ feedbacks });
  } catch (err) {
    return handleApiError(err, "获取反馈列表");
  }
}
