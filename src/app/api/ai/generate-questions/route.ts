import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { generatePracticeQuestions } from "@/lib/practice-generator";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const {
      type = "daily",
      subject,
      count,
      materialIds,
      wrongQuestionIds,
    } = body;

    if (!subject) {
      return NextResponse.json({ error: "请选择科目" }, { status: 400 });
    }

    // Resolve "auto" wrongQuestionIds
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

    const questions = await generatePracticeQuestions({
      userId: user!.id,
      type,
      subject,
      count,
      materialIds,
      wrongQuestionIds: resolvedWrongIds,
    });

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Generate questions error:", err);
    return NextResponse.json({ error: "生成题目失败" }, { status: 500 });
  }
}
