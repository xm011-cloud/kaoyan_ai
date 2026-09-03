import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { deriveGoalStatus, isGoalStatus } from "@/lib/goal-model";

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSubjects(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
}

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
    const { targetScores, progress, subjectsEdited, studyLoad } = body;
    const university = optionalText(body.university);
    const major = optionalText(body.major);
    const direction = optionalText(body.direction);
    const examDate = optionalDate(body.examDate);
    const subjects = normalizeSubjects(body.subjects);

    if (body.examDate && !examDate) {
      return jsonNoStore({ error: "考试日期格式不正确" }, { status: 400 });
    }

    if (!direction && !university && !major && subjects.length === 0) {
      return jsonNoStore({ error: "请至少填写一个学习方向、专业或科目" }, { status: 400 });
    }

    const requestedStatus = isGoalStatus(body.status) ? body.status : undefined;
    const status = requestedStatus === "paused"
      ? requestedStatus
      : deriveGoalStatus({ university, major, direction, examDate, subjects });
    const examYear = Number.isInteger(body.examYear) ? body.examYear : examDate?.getFullYear() ?? null;
    const certainty = body.certainty === "low" || body.certainty === "high" ? body.certainty : "medium";

    const goal = await prisma.goal.upsert({
      where: { userId: user!.id },
      create: {
        userId: user!.id, type: optionalText(body.type) || "postgraduate", status, direction, university, major,
        examDate, examYear, certainty, confirmedAt: status === "confirmed" ? new Date() : null,
        subjects,
        targetScores: targetScores || undefined,
        progress: progress || undefined,
        studyLoad: studyLoad || undefined,
        subjectsEdited: subjectsEdited ?? false,
      },
      update: {
        type: optionalText(body.type) || "postgraduate", status, direction, university, major,
        examDate, examYear, certainty,
        confirmedAt: status === "confirmed" ? new Date() : null,
        subjects,
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
    const { targetScores, progress, subjectsEdited, studyLoad } = body;

    const existing = await prisma.goal.findUnique({ where: { userId: user!.id } });
    if (!existing) return jsonNoStore({ error: "目标不存在" }, { status: 404 });

    const university = body.university !== undefined ? optionalText(body.university) : existing.university;
    const major = body.major !== undefined ? optionalText(body.major) : existing.major;
    const direction = body.direction !== undefined ? optionalText(body.direction) : existing.direction;
    const examDate = body.examDate !== undefined ? optionalDate(body.examDate) : existing.examDate;
    const subjects = body.subjects !== undefined ? normalizeSubjects(body.subjects) : existing.subjects;

    if (body.examDate && !examDate) {
      return jsonNoStore({ error: "考试日期格式不正确" }, { status: 400 });
    }
    const requestedStatus = isGoalStatus(body.status) ? body.status : undefined;
    const status = requestedStatus === "paused"
      ? requestedStatus
      : deriveGoalStatus({ university, major, direction, examDate, subjects });

    const goal = await prisma.goal.update({
      where: { userId: user!.id },
      data: {
        ...(body.type !== undefined && { type: optionalText(body.type) || existing.type }),
        status,
        ...(body.direction !== undefined && { direction }),
        ...(body.university !== undefined && { university }),
        ...(body.major !== undefined && { major }),
        ...(body.examDate !== undefined && { examDate }),
        ...(body.examYear !== undefined && { examYear: Number.isInteger(body.examYear) ? body.examYear : null }),
        ...(body.certainty !== undefined && { certainty: body.certainty === "low" || body.certainty === "high" ? body.certainty : "medium" }),
        ...(body.subjects !== undefined && { subjects }),
        confirmedAt: status === "confirmed" ? existing.confirmedAt || new Date() : null,
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
