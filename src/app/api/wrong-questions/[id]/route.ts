import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    }

    return NextResponse.json({ question: wq });
  } catch (err) {
    console.error("Get wrong-question error:", err);
    return NextResponse.json({ error: "获取错题失败" }, { status: 500 });
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
      return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    }

    const body = await request.json();

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

    const updated = await prisma.wrongQuestion.update({
      where: { id },
      data,
    });

    return NextResponse.json({ question: updated });
  } catch (err) {
    console.error("Update wrong-question error:", err);
    return NextResponse.json({ error: "更新错题失败" }, { status: 500 });
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
      return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    }

    await prisma.wrongQuestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete wrong-question error:", err);
    return NextResponse.json({ error: "删除错题失败" }, { status: 500 });
  }
}
