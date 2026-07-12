import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取当前用户的目标
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const goal = await prisma.goal.findUnique({
    where: { userId: user!.id },
  });

  return NextResponse.json({ goal });
}

// POST: 创建或更新目标
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { university, major, examDate, subjects } = body;

  if (!university || !major || !examDate || !subjects?.length) {
    return NextResponse.json({ error: "请填写所有必填字段" }, { status: 400 });
  }

  const goal = await prisma.goal.upsert({
    where: { userId: user!.id },
    create: {
      userId: user!.id,
      university,
      major,
      examDate: new Date(examDate),
      subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean),
    },
    update: {
      university,
      major,
      examDate: new Date(examDate),
      subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean),
    },
  });

  return NextResponse.json({ goal });
}

// PUT: 更新目标
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { university, major, examDate, subjects } = body;

  const goal = await prisma.goal.update({
    where: { userId: user!.id },
    data: {
      ...(university && { university }),
      ...(major && { major }),
      ...(examDate && { examDate: new Date(examDate) }),
      ...(subjects && { subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean) }),
    },
  });

  return NextResponse.json({ goal });
}
