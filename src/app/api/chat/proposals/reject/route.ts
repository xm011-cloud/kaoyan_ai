import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { revokeProposal } from "@/lib/proposals";
import { jsonNoStore } from "@/lib/api-utils";

// POST /api/chat/proposals/reject — 拒绝提案：清空草稿，不落任何任务（直连按钮，绕过 AI 循环）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { chatId, proposalId } = body;

    if (!chatId || !proposalId) {
      return jsonNoStore({ error: "参数不完整" }, { status: 400 });
    }

    await revokeProposal(user!.id, chatId as string, proposalId as string);
    return jsonNoStore({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "提案处理失败";
    return jsonNoStore({ error: message }, { status: 400 });
  }
}
