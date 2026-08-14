import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";

// GET: 待审核的院校数据质疑列表（含关联数据与质疑人）
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const disputes = await prisma.admissionFeedback.findMany({
      where: { type: "dispute", status: "pending" },
      include: {
        admissionInfo: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonNoStore({
      disputes: disputes.map((d) => ({
        id: d.id,
        reason: d.reason,
        createdAt: d.createdAt,
        userEmail: d.user?.email || "未知",
        admission: {
          id: d.admissionInfo.id,
          university: d.admissionInfo.university,
          major: d.admissionInfo.major,
          year: d.admissionInfo.year,
          category: d.admissionInfo.category,
          data: d.admissionInfo.data,
          source: d.admissionInfo.source,
          verifyStatus: d.admissionInfo.verifyStatus,
        },
      })),
    });
  } catch (err) {
    return handleApiError(err, "获取质疑列表");
  }
}
