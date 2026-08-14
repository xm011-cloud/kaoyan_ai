import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// POST: 审核一条质疑
// body: { action: "accept" | "reject" }
// accept = 确认数据错误 → 数据标记 rejected（存疑不采用）
// reject = 驳回质疑 → 数据回 unverified（若无其他待审核质疑）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    let action: unknown;
    try {
      ({ action } = await request.json());
    } catch {
      return jsonNoStore({ error: "请求格式错误" }, { status: 400 });
    }
    if (action !== "accept" && action !== "reject") {
      return jsonNoStore({ error: "无效的参数" }, { status: 400 });
    }

    const feedback = await prisma.admissionFeedback.findUnique({
      where: { id },
    });
    if (!feedback || feedback.type !== "dispute") {
      return jsonNoStore({ error: "质疑不存在" }, { status: 404 });
    }

    await prisma.admissionFeedback.update({
      where: { id },
      data: { status: action === "accept" ? "accepted" : "rejected" },
    });

    if (action === "accept") {
      // 确认错误 → 数据标记 rejected（存疑）
      await prisma.admissionInfo.update({
        where: { id: feedback.admissionInfoId },
        data: { verifyStatus: "rejected" },
      });
    } else {
      // 驳回 → 若无其他待审核质疑，数据回 unverified
      const pending = await prisma.admissionFeedback.count({
        where: {
          admissionInfoId: feedback.admissionInfoId,
          type: "dispute",
          status: "pending",
        },
      });
      if (pending === 0) {
        const info = await prisma.admissionInfo.findUnique({
          where: { id: feedback.admissionInfoId },
        });
        if (info && info.verifyStatus === "disputed") {
          await prisma.admissionInfo.update({
            where: { id: info.id },
            data: { verifyStatus: "unverified" },
          });
        }
      }
    }

    return jsonNoStore({ ok: true });
  } catch (err) {
    return handleApiError(err, "审核质疑");
  }
}
