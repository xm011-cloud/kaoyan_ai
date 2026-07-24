import { NextResponse } from "next/server";

/**
 * 统一 API 错误返回。始终返回 { error: string } 格式和 500 状态码，
 * 在服务端 console.error 记录原始错误。
 */
export function handleApiError(err: unknown, context: string): ReturnType<typeof NextResponse.json> {
  console.error(`[API] ${context}:`, err instanceof Error ? err.message : String(err));
  return NextResponse.json(
    { error: `${context}失败，请稍后再试` },
    { status: 500 }
  );
}
