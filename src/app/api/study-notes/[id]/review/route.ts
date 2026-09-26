import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

type Context = { params: Promise<{ id: string }> };
type ReviewRating = "clear" | "fuzzy" | "blocked";

function nextReviewDate(rating: ReviewRating, previousCount: number): Date {
  const days = rating === "clear" ? Math.min(21, Math.max(3, (previousCount + 1) * 3)) : rating === "fuzzy" ? 1 : 0;
  const next = new Date();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

// 回顾只安排下一次提示，不推断阶段掌握或自动推进任何里程碑。
export async function POST(request: NextRequest, { params }: Context) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rating = body.rating as ReviewRating;
    if (!(["clear", "fuzzy", "blocked"] as const).includes(rating)) {
      return jsonNoStore({ error: "请选择本次回顾状态" }, { status: 400 });
    }
    const note = await prisma.studyNote.findFirst({ where: { id, userId: user!.id } });
    if (!note) return jsonNoStore({ error: "理解记录不存在" }, { status: 404 });
    const updated = await prisma.studyNote.update({
      where: { id },
      data: {
        reviewCount: { increment: 1 },
        lastReviewedAt: new Date(),
        nextReviewAt: nextReviewDate(rating, note.reviewCount),
      },
    });
    return jsonNoStore({ note: updated, rating });
  } catch (err) {
    return handleApiError(err, "记录理解卡回顾");
  }
}
