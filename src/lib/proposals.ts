import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/date-utils";

// ── 对话→任务落地（事务边界）──
// propose_tasks 只把草稿挂到 Chat.pendingProposal，不落 Task。
// 用户确认后由 confirmProposal 批量落库（source: "ai_confirmed"），撤销走 revokeProposal。

export interface ProposalItem {
  title: string;
  date: string; // YYYY-MM-DD
  duration: number;
  subject?: string | null;
  description?: string | null;
}

export interface Proposal {
  proposalId: string;
  items: ProposalItem[];
  note?: string | null;
  createdAt?: string;
}

/** 确认提案：把草稿任务批量落库（$transaction），source 标记 ai_confirmed */
export async function confirmProposal(
  userId: string,
  chatId: string,
  proposalId: string,
  items: ProposalItem[]
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("没有可采纳的任务");
  }

  return prisma.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({ where: { id: chatId, userId } });
    const pending = chat?.pendingProposal as Proposal | null;
    if (!chat || !pending || pending.proposalId !== proposalId) {
      throw new Error("提案不存在或已失效，请刷新后重试");
    }

    const created = await tx.task.createMany({
      data: items.map((it) => {
        const date = new Date(it.date);
        return {
          userId,
          title: it.title,
          description: it.description ?? null,
          date,
          duration: it.duration || null,
          subject: it.subject || null,
          weekStartDate: getWeekStart(date),
          source: "ai_confirmed",
          proposalId,
          chatId,
        };
      }),
    });

    // 落库后清空待确认提案，避免重复采纳
    await tx.chat.update({
      where: { id: chatId },
      data: { pendingProposal: Prisma.DbNull },
    });

    return created.count;
  });
}

/** 撤销提案：清空待确认提案（不落任何任务） */
export async function revokeProposal(userId: string, chatId: string, proposalId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({ where: { id: chatId, userId } });
    const pending = chat?.pendingProposal as Proposal | null;
    if (!chat || !pending || pending.proposalId !== proposalId) {
      throw new Error("提案不存在或已失效，请刷新后重试");
    }

    // 防御性清理：若提案曾被部分落库（正常流程不会），一并撤销
    await tx.task.deleteMany({ where: { userId, proposalId } });
    await tx.chat.update({
      where: { id: chatId },
      data: { pendingProposal: Prisma.DbNull },
    });

    return true;
  });
}
