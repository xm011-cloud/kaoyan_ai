import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 查询当前用户的注销请求状态
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const req = await prisma.deletionRequest.findUnique({
      where: { userId: user!.id },
    });
    return jsonNoStore({
      requested: !!req,
      status: req?.status || null,
      createdAt: req?.createdAt || null,
    });
  } catch (err) {
    return handleApiError(err, "查询注销请求");
  }
}

// POST: 提交注销请求（幂等：已存在则返回现状）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const record = await prisma.deletionRequest.upsert({
      where: { userId: user!.id },
      update: {}, // 已请求则不重复
      create: {
        userId: user!.id,
        email: user!.email || `${user!.id}@unknown`,
        status: "pending",
      },
    });
    return jsonNoStore({ requested: true, status: record.status });
  } catch (err) {
    return handleApiError(err, "提交注销请求");
  }
}

// DELETE: 取消注销请求（反悔）
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    await prisma.deletionRequest.deleteMany({ where: { userId: user!.id } });
    return jsonNoStore({ requested: false });
  } catch (err) {
    return handleApiError(err, "取消注销请求");
  }
}
