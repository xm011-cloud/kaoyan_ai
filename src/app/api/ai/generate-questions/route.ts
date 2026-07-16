import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { generatePracticeQuestions } from "@/lib/practice-generator";

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

    const questions = await generatePracticeQuestions({
      userId: user!.id,
      type,
      subject,
      count,
      materialIds,
      wrongQuestionIds,
    });

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Generate questions error:", err);
    return NextResponse.json({ error: "生成题目失败" }, { status: 500 });
  }
}
