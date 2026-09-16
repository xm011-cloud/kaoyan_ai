import { NextResponse } from "next/server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/**
 * 返回 JSON 响应并禁止缓存。用于所有返回用户私有数据的 API 路由。
 */
export function jsonNoStore(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  });
}

/**
 * 统一 API 错误返回。为每次异常生成可关联 Vercel 日志的编号，
 * 客户端只收到安全的提示与编号，不能看到原始异常、堆栈或敏感上下文。
 */
export function handleApiError(err: unknown, context: string): ReturnType<typeof NextResponse.json> {
  const errorId = crypto.randomUUID();
  const errorName = err instanceof Error ? err.name : "UnknownError";
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api_error]", { errorId, context, errorName, message });
  return NextResponse.json(
    { error: `${context}失败，请稍后再试`, errorId },
    { status: 500, headers: { ...NO_STORE_HEADERS, "X-C6-Error-Id": errorId } }
  );
}
