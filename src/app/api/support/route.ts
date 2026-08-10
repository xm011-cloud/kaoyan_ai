import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { isHoneypot, isRateLimited, parseJsonBody } from "@/lib/rate-limit";

// 感谢墙：公开页，只返回已审核的留言（jsonNoStore 保证审核后立即生效，不缓存）
export async function GET() {
  try {
    const supporters = await prisma.supporter.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, message: true, amount: true, createdAt: true },
    });
    return jsonNoStore({ supporters });
  } catch (err) {
    return handleApiError(err, "获取感谢墙");
  }
}

// 支持留言：公开可提交，但需作者审核后才上墙
// 防滥用：蜜罐 + 生产限流 3/min/IP + 长度上限 + 服务端强制金额 ¥9.9
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if (!parsed) return jsonNoStore({ error: "请求格式错误" }, { status: 400 });

  // 蜜罐被填 → 假装成功
  if (isHoneypot(parsed)) return jsonNoStore({ ok: true });

  // 限流（仅生产）
  if (isRateLimited(request, { max: 3, feature: "support" })) {
    return jsonNoStore({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";

  if (!name || name.length > 30) {
    return jsonNoStore({ error: "昵称长度需在 1-30 字之间" }, { status: 400 });
  }
  if (message.length > 200) {
    return jsonNoStore({ error: "留言不能超过 200 字" }, { status: 400 });
  }

  try {
    // 已登录则顺带记录 userId（游客也可匿名留言）
    const { user } = await getAuthUser(request);
    await prisma.supporter.create({
      data: {
        name,
        message: message || null,
        amount: 9.9, // 服务端强制，忽略客户端金额
        approved: false, // 待审核
        userId: user?.id ?? null,
      },
    });
    return jsonNoStore({ ok: true });
  } catch (err) {
    return handleApiError(err, "提交留言");
  }
}
