import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { isHoneypot, isRateLimited, parseJsonBody } from "@/lib/rate-limit";

const FEEDBACK_TYPES = ["problem", "confusing", "idea", "praise", "other", "general"] as const;

function safeSourcePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  return path.startsWith("/") && path.length <= 200 ? path : null;
}

function safeClientContext(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const context: Record<string, string> = {};
  for (const key of ["viewport", "device", "locale"] as const) {
    if (typeof source[key] === "string" && source[key].trim().length > 0) {
      context[key] = source[key].trim().slice(0, 80);
    }
  }
  return Object.keys(context).length > 0 ? context : null;
}

function serializeFeedback(feedback: {
  id: string;
  rating: number;
  content: string;
  type: string;
  sourcePath: string | null;
  clientContext: unknown;
  status: string;
  authorNote: string | null;
  releaseVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...feedback,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
  };
}

// 产品反馈：需登录提交（proxy 已保护页面，接口自身再鉴权一次）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const feedbacks = await prisma.authorFeedback.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        content: true,
        type: true,
        sourcePath: true,
        clientContext: true,
        status: true,
        authorNote: true,
        releaseVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return jsonNoStore({ feedbacks: feedbacks.map(serializeFeedback) });
  } catch (err) {
    return handleApiError(err, "获取产品反馈");
  }
}

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

  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  const requestedType = typeof parsed.type === "string" ? parsed.type : "general";
  const type = FEEDBACK_TYPES.includes(requestedType as (typeof FEEDBACK_TYPES)[number]) ? requestedType : "general";
  // 兼容旧数据库的必填 rating：新表单不再要求用户为问题打分，未传入时保存中性值。
  const requestedRating = Number(parsed.rating);
  const rating = Number.isInteger(requestedRating) && requestedRating >= 1 && requestedRating <= 5 ? requestedRating : 3;
  if (!content || content.length > 2000) {
    return jsonNoStore({ error: "请用 1-2000 字说明你的情况" }, { status: 400 });
  }

  try {
    const feedback = await prisma.authorFeedback.create({
      data: {
        userId: user!.id,
        rating,
        content,
        type,
        sourcePath: safeSourcePath(parsed.sourcePath),
        clientContext: safeClientContext(parsed.clientContext) ?? Prisma.JsonNull,
      },
    });
    return jsonNoStore({ ok: true, feedback: serializeFeedback(feedback) });
  } catch (err) {
    return handleApiError(err, "提交反馈");
  }
}
