import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

// GET: 用户导入的真题列表（按科目/年份筛选）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = { userId: user!.id };
    if (subject) where.subject = subject;
    if (year) where.year = parseInt(year);

    const [questions, counts] = await Promise.all([
      prisma.importedQuestion.findMany({
        where,
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.importedQuestion.groupBy({
        by: ["subject"],
        where: { userId: user!.id },
        _count: { _all: true },
      }),
    ]);

    return jsonNoStore({
      questions: questions.map((q) => ({
        id: q.id,
        subject: q.subject,
        year: q.year,
        type: q.type,
        question: q.question.slice(0, 200),
        answer: q.answer.slice(0, 120),
        source: q.source,
        sourceName: q.sourceName,
        tags: q.tags,
        createdAt: q.createdAt,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.subject, c._count._all])),
      total: counts.reduce((s, c) => s + c._count._all, 0),
    });
  } catch (err) {
    return handleApiError(err, "获取真题列表");
  }
}

// DELETE: 删除一条导入的真题
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return jsonNoStore({ error: "缺少 ID" }, { status: 400 });
    }
    const record = await prisma.importedQuestion.findFirst({
      where: { id, userId: user!.id },
    });
    if (!record) {
      return jsonNoStore({ error: "真题不存在" }, { status: 404 });
    }
    await prisma.importedQuestion.delete({ where: { id } });
    return jsonNoStore({ success: true });
  } catch (err) {
    return handleApiError(err, "删除真题");
  }
}
