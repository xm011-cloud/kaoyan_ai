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
 * 统一 API 错误返回。始终返回 { error: string } 格式和 500 状态码，
 * 在服务端 console.error 记录原始错误。
 */
export function handleApiError(err: unknown, context: string): ReturnType<typeof NextResponse.json> {
  console.error(`[API] ${context}:`, err instanceof Error ? err.message : String(err));
  return NextResponse.json(
    { error: `${context}失败，请稍后再试` },
    { status: 500, headers: NO_STORE_HEADERS }
  );
}
