import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const reviewed = searchParams.get("reviewed");
    const source = searchParams.get("source");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId: user!.id };

    if (subject) where.subject = subject;
    if (reviewed === "true") where.reviewed = true;
    if (reviewed === "false") where.reviewed = false;
    if (source) where.source = source;

    const [questions, total] = await Promise.all([
      prisma.wrongQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.wrongQuestion.count({ where }),
    ]);

    // Client-side filter for tag and search (since Prisma doesn't easily filter arrays/strings)
    let filtered = questions;
    if (tag) {
      filtered = filtered.filter((q) => q.tags.some((t) => t.includes(tag!)));
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.question.toLowerCase().includes(s) ||
          q.answer.toLowerCase().includes(s) ||
          q.tags.some((t) => t.toLowerCase().includes(s))
      );
    }

    return NextResponse.json({ questions: filtered, total });
  } catch (err) {
    console.error("List wrong-questions error:", err);
    return NextResponse.json({ error: "获取错题列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { subject, question, answer, source, sourceChatId, tags } = body;

    if (!subject || !question || !answer) {
      return NextResponse.json(
        { error: "科目、题目和答案不能为空" },
        { status: 400 }
      );
    }

    const wq = await prisma.wrongQuestion.create({
      data: {
        userId: user!.id,
        subject,
        question: question.slice(0, 5000),
        answer: answer.slice(0, 5000),
        source: source || "manual",
        sourceChatId: sourceChatId || null,
        tags: tags || [],
      },
    });

    return NextResponse.json({ question: wq });
  } catch (err) {
    console.error("Create wrong-question error:", err);
    return NextResponse.json({ error: "添加错题失败" }, { status: 500 });
  }
}
