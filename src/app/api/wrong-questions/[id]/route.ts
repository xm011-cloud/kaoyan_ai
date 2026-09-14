import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveEvidenceLink, upsertStudyEvidence } from "@/lib/study-evidence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const wq = await prisma.wrongQuestion.findUnique({ where: { id } });

    if (!wq || wq.userId !== user!.id) {
      return jsonNoStore({ error: "错题不存在" }, { status: 404 });
    }

    return jsonNoStore({ question: wq });
  } catch (err) {
    console.error("Get wrong-question error:", err);
    return jsonNoStore({ error: "获取错题失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.wrongQuestion.findUnique({ where: { id } });

    if (!existing || existing.userId !== user!.id) {
      return jsonNoStore({ error: "错题不存在" }, { status: 404 });
    }

    const body = await request.json();
    const reviewEventId = typeof body.reviewEventId === "string" && body.reviewEventId.length <= 120
      ? body.reviewEventId
      : null;
    if (body.reviewed === true && reviewEventId) {
      const recorded = await prisma.studyEvidence.findUnique({
        where: { userId_kind_sourceId: { userId: user!.id, kind: "wrong_review", sourceId: reviewEventId } },
        select: { id: true },
      });
      if (recorded) return jsonNoStore({ question: existing, deduplicated: true });
    }

    // Handle "mark as reviewed" — SM-2 spaced repetition algorithm
    const data: Record<string, unknown> = {};
    if (body.question !== undefined) data.question = body.question;
    if (body.answer !== undefined) data.answer = body.answer;
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.reviewed !== undefined) {
      data.reviewed = body.reviewed;
      if (body.reviewed === true) {
        const rating: number = body.rating ?? 3; // 0-5 scale, default = passing
        const oldEase = existing.easeFactor ?? 2.5;
        const oldInterval = existing.interval ?? 0;

        // SM-2 algorithm
        let newEase = oldEase + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
        if (newEase < 1.3) newEase = 1.3;

        let newInterval: number;
        if (rating < 3) {
          // Failed — reset
          newInterval = 1;
        } else if (oldInterval === 0) {
          newInterval = 1;
        } else if (oldInterval === 1) {
          newInterval = 3;
        } else {
          newInterval = Math.round(oldInterval * newEase);
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        nextDate.setHours(0, 0, 0, 0);

        data.reviewCount = (existing.reviewCount || 0) + 1;
        data.lastReviewDate = new Date();
        data.easeFactor = newEase;
        data.interval = newInterval;
        data.nextReviewDate = nextDate;
      }
    }
    if (body.nextReviewDate !== undefined)
      data.nextReviewDate = new Date(body.nextReviewDate);
    const reviewLink = body.reviewed === true
      ? await resolveEvidenceLink(prisma, user!.id, {
          taskId: body.taskId ?? existing.taskId,
          milestoneId: body.milestoneId ?? existing.milestoneId,
          subject: existing.subject,
        })
      : { link: null as null, error: undefined as string | undefined };
    if (reviewLink.error) return jsonNoStore({ error: reviewLink.error }, { status: 400 });
    if (body.reviewed === true) {
      data.taskId = reviewLink.link?.taskId ?? null;
      data.milestoneId = reviewLink.link?.milestoneId ?? null;
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      if (body.reviewed === true && reviewEventId) {
        // 相同复习事件可能因双击或网络重试并发到达；先锁住错题，再在锁内复核唯一事件。
        await tx.$queryRaw`SELECT "id" FROM "WrongQuestion" WHERE "id" = ${id} FOR UPDATE`;
        const recorded = await tx.studyEvidence.findUnique({
          where: { userId_kind_sourceId: { userId: user!.id, kind: "wrong_review", sourceId: reviewEventId } },
          select: { id: true },
        });
        if (recorded) {
          return { question: await tx.wrongQuestion.findUniqueOrThrow({ where: { id } }), deduplicated: true };
        }
      }
      const next = await tx.wrongQuestion.update({ where: { id }, data });
      if (body.reviewed === true) {
        await upsertStudyEvidence(tx, {
          userId: user!.id,
          taskId: reviewLink.link?.taskId ?? next.taskId,
          milestoneId: reviewLink.link?.milestoneId ?? next.milestoneId,
          kind: "wrong_review",
          sourceId: reviewEventId ?? `${next.id}:${next.reviewCount}`,
          title: `错题复习：${next.question}`,
          subject: next.subject,
          occurredAt: next.lastReviewDate ?? new Date(),
          metadata: {
            wrongQuestionId: next.id,
            rating: body.rating ?? 3,
            reviewCount: next.reviewCount,
            interval: next.interval,
            easeFactor: next.easeFactor,
          },
        });
      }
      return { question: next, deduplicated: false };
    }, { timeout: 30_000 });

    return jsonNoStore(transactionResult);
  } catch (err) {
    console.error("Update wrong-question error:", err);
    return jsonNoStore({ error: "更新错题失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.wrongQuestion.findUnique({ where: { id } });

    if (!existing || existing.userId !== user!.id) {
      return jsonNoStore({ error: "错题不存在" }, { status: 404 });
    }

    await prisma.wrongQuestion.delete({ where: { id } });
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error("Delete wrong-question error:", err);
    return jsonNoStore({ error: "删除错题失败" }, { status: 500 });
  }
}
