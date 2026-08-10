import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { isHoneypot, isRateLimited, parseJsonBody } from "@/lib/rate-limit";

// 意见反馈：需登录提交（proxy 已保护页面，接口自身再鉴权一次）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const parsed = await parseJsonBody(request);
  if (!parsed) return jsonNoStore({ error: "请求格式错误" }, { status: 400 });

  // 蜜罐被填 → 假装成功
  if (isHoneypot(parsed)) return jsonNoStore({ ok: true });

  // 限流（仅生产）：登录用户 10 次/分钟
  if (isRateLimited(request, { max: 10, feature: "suggestions" })) {
    return jsonNoStore({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  const rating = Number(parsed.rating);
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  const anonymous = Boolean(parsed.anonymous);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonNoStore({ error: "请选择 1-5 星评分" }, { status: 400 });
  }
  if (!content || content.length > 2000) {
    return jsonNoStore({ error: "意见内容需在 1-2000 字之间" }, { status: 400 });
  }

  try {
    await prisma.authorFeedback.create({
      data: { userId: user!.id, rating, content, anonymous },
    });
    return jsonNoStore({ ok: true });
  } catch (err) {
    return handleApiError(err, "提交反馈");
  }
}
