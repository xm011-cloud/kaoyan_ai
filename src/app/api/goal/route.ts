import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 获取当前用户的目标
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const goal = await prisma.goal.findUnique({
      where: { userId: user!.id },
    });
    return jsonNoStore({ goal });
  } catch (err) {
    return handleApiError(err, "获取目标");
  }
}

// POST: 创建或更新目标
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { university, major, examDate, subjects, targetScores, progress, subjectsEdited, studyLoad } = body;

    if (!university || !major || !examDate || !subjects?.length) {
      return jsonNoStore({ error: "请填写所有必填字段" }, { status: 400 });
    }

    const goal = await prisma.goal.upsert({
      where: { userId: user!.id },
      create: {
        userId: user!.id, university, major,
        examDate: new Date(examDate),
        subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean),
        targetScores: targetScores || undefined,
        progress: progress || undefined,
        studyLoad: studyLoad || undefined,
        subjectsEdited: subjectsEdited ?? false,
      },
      update: {
        university, major,
        examDate: new Date(examDate),
        subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean),
        targetScores: targetScores || null,
        progress: progress || null,
        studyLoad: studyLoad || null,
        ...(subjectsEdited !== undefined && { subjectsEdited }),
      },
    });

    return jsonNoStore({ goal });
  } catch (err) {
    return handleApiError(err, "保存目标");
  }
}

// PUT: 更新目标
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { university, major, examDate, subjects, targetScores, progress, subjectsEdited, studyLoad } = body;

    const goal = await prisma.goal.update({
      where: { userId: user!.id },
      data: {
        ...(university && { university }),
        ...(major && { major }),
        ...(examDate && { examDate: new Date(examDate) }),
        ...(subjects && { subjects: Array.isArray(subjects) ? subjects : subjects.split("\n").filter(Boolean) }),
        ...(targetScores !== undefined && { targetScores }),
        ...(progress !== undefined && { progress }),
        ...(studyLoad !== undefined && { studyLoad }),
        ...(subjectsEdited !== undefined && { subjectsEdited }),
      },
    });

    return jsonNoStore({ goal });
  } catch (err) {
    return handleApiError(err, "更新目标");
  }
}
