import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { confirmProposal } from "@/lib/proposals";
import { jsonNoStore } from "@/lib/api-utils";

// POST /api/chat/proposals/confirm — 确认提案：批量落库任务（直连按钮，绕过 AI 循环）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { chatId, proposalId, items } = body;

    if (!chatId || !proposalId || !Array.isArray(items) || items.length === 0) {
      return jsonNoStore({ error: "参数不完整" }, { status: 400 });
    }

    const created = await confirmProposal(user!.id, chatId as string, proposalId as string, items);
    return jsonNoStore({ success: true, created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "提案处理失败";
    return jsonNoStore({ error: message }, { status: 400 });
  }
}
