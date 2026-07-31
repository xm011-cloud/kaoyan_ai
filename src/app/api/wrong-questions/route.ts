import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

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

    const dueToday = searchParams.get("dueToday");
    const where: Record<string, unknown> = { userId: user!.id };

    if (subject) where.subject = subject;
    if (reviewed === "true") where.reviewed = true;
    if (reviewed === "false") where.reviewed = false;
    if (source) where.source = source;

    // 标签筛选：下推到数据库
    if (tag) {
      where.tags = { hasSome: [tag] };
    }

    // 搜索筛选：下推到数据库
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } },
        { tags: { hasSome: [search] } },
      ];
    }

    // dueToday: unreviewed and nextReviewDate is today or earlier
    if (dueToday === "true") {
      where.reviewed = false;
      where.nextReviewDate = {
        lte: new Date(new Date().setHours(23, 59, 59, 999)),
      };
    }

    const [questions, total] = await Promise.all([
      prisma.wrongQuestion.findMany({
        where,
        orderBy: { nextReviewDate: "asc" },
        skip,
        take: limit,
      }),
      prisma.wrongQuestion.count({ where }),
    ]);

    return jsonNoStore({ questions, total });
  } catch (err) {
    return handleApiError(err, "获取错题列表");
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { subject, question, answer, source, sourceChatId, tags } = body;

    if (!subject || !question || !answer) {
      return jsonNoStore(
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

    return jsonNoStore({ question: wq });
  } catch (err) {
    return handleApiError(err, "添加错题");
  }
}
