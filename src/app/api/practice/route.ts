import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generatePracticeQuestions } from "@/lib/practice-generator";
import { Prisma } from "@prisma/client";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const subject = searchParams.get("subject");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const where: Record<string, unknown> = { userId: user!.id };
    if (type) where.type = type;
    if (subject) where.subject = subject;
    if (status) where.status = status;

    const sessions = await prisma.practiceSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return jsonNoStore({ sessions });
  } catch (err) {
    return handleApiError(err, "获取练习列表");
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { type = "daily", subject, duration, materialIds, wrongQuestionIds } = body;

    if (!subject) {
      return jsonNoStore({ error: "请选择科目" }, { status: 400 });
    }

    if (!["daily", "mock"].includes(type)) {
      return jsonNoStore({ error: "类型无效" }, { status: 400 });
    }

    // Resolve "auto" wrongQuestionIds → fetch recent wrong questions for subject
    let resolvedWrongIds: string[] | undefined;
    if (wrongQuestionIds === "auto") {
      const recentWrong = await prisma.wrongQuestion.findMany({
        where: { userId: user!.id, subject },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const ids = recentWrong.map((w) => w.id);
      resolvedWrongIds = ids.length > 0 ? ids : undefined;
    } else if (Array.isArray(wrongQuestionIds) && wrongQuestionIds.length > 0) {
      resolvedWrongIds = wrongQuestionIds;
    }

    // Generate questions first (via AI or local fallback)
    const count = type === "daily" ? 5 : 20;
    const questions = await generatePracticeQuestions({
      userId: user!.id,
      type,
      subject,
      count,
      materialIds,
      wrongQuestionIds: resolvedWrongIds,
    });

    // Create session with generated questions
    const maxScore = questions.length * 10;
    const session = await prisma.practiceSession.create({
      data: {
        userId: user!.id,
        type,
        subject,
        status: "in_progress",
        duration: type === "mock" ? duration || 180 : null,
        startedAt: new Date(),
        questions: questions as unknown as Prisma.InputJsonValue,
        maxScore,
      },
    });

    return jsonNoStore({ session });
  } catch (err) {
    return handleApiError(err, "创建练习");
  }
}
