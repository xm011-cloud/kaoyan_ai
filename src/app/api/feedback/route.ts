import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取反馈列表
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const feedbacks = await prisma.feedback.findMany({
    where: { userId: user!.id },
    orderBy: { weekStart: "desc" },
    take: 10,
  });

  return NextResponse.json({ feedbacks });
}
