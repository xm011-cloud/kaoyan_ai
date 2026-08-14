import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST: 对院校数据投认同 👍 / 质疑 ⚠️（一人一条，可改投/取消）
// body: { admissionInfoId, type: "vouch" | "dispute", reason? }
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { admissionInfoId, type, reason } = body;

    if (!admissionInfoId || !["vouch", "dispute"].includes(type)) {
      return jsonNoStore({ error: "参数无效" }, { status: 400 });
    }
    if (type === "dispute" && !reason?.trim()) {
      return jsonNoStore({ error: "质疑需要填写原因" }, { status: 400 });
    }

    const info = await prisma.admissionInfo.findUnique({
      where: { id: admissionInfoId },
    });
    if (!info) {
      return jsonNoStore({ error: "数据不存在" }, { status: 404 });
    }

    const existing = await prisma.admissionFeedback.findUnique({
      where: {
        admissionInfoId_userId: { admissionInfoId, userId: user!.id },
      },
    });

    // 已有同类型反馈 → 取消（删除）
    if (existing && existing.type === type) {
      await prisma.admissionFeedback.delete({ where: { id: existing.id } });
      // 若取消的是质疑，恢复数据验证状态（若无其他 pending 质疑）
      if (type === "dispute") {
        await refreshVerifyStatus(info.id);
      }
      return jsonNoStore({ action: "removed", counts: await getCounts(info.id) });
    }

    // 改投（vouch ↔ dispute）或新增
    const feedback = await prisma.admissionFeedback.upsert({
      where: { admissionInfoId_userId: { admissionInfoId, userId: user!.id } },
      update: {
        type,
        reason: type === "dispute" ? reason.trim() : null,
        status: "pending",
        createdAt: new Date(),
      },
      create: {
        admissionInfoId,
        userId: user!.id,
        type,
        reason: type === "dispute" ? reason.trim() : null,
      },
    });

    // 质疑 → 数据标记 disputed
    if (type === "dispute") {
      await prisma.admissionInfo.update({
        where: { id: info.id },
        data: { verifyStatus: "disputed" },
      });
    }

    return jsonNoStore({ action: "saved", feedback, counts: await getCounts(info.id) });
  } catch (err) {
    console.error("Admission feedback error:", err);
    return jsonNoStore({ error: "操作失败" }, { status: 500 });
  }
}

async function getCounts(id: string) {
  const [vouch, dispute] = await Promise.all([
    prisma.admissionFeedback.count({ where: { admissionInfoId: id, type: "vouch" } }),
    prisma.admissionFeedback.count({ where: { admissionInfoId: id, type: "dispute" } }),
  ]);
  return { vouch, dispute };
}

/** 质疑变化后刷新数据验证状态：无 pending 质疑 → 回 unverified */
async function refreshVerifyStatus(infoId: string) {
  const pending = await prisma.admissionFeedback.count({
    where: { admissionInfoId: infoId, type: "dispute", status: "pending" },
  });
  const info = await prisma.admissionInfo.findUnique({ where: { id: infoId } });
  if (!info) return;
  if (pending === 0 && info.verifyStatus === "disputed") {
    await prisma.admissionInfo.update({
      where: { id: infoId },
      data: { verifyStatus: "unverified" },
    });
  }
}
