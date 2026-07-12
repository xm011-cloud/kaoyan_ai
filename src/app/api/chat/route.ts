import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取对话历史
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const chats = await prisma.chat.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      messages: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ chats });
}

// POST: 保存对话 / 发送消息
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { chatId, messages } = body;

  if (!messages) {
    return NextResponse.json({ error: "消息内容不能为空" }, { status: 400 });
  }

  if (chatId) {
    // 更新已有对话
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user!.id },
    });
    if (!chat) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 });
    }

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: { messages },
    });

    return NextResponse.json({ chat: updated });
  }

  // 创建新对话
  const chat = await prisma.chat.create({
    data: {
      userId: user!.id,
      messages,
    },
  });

  return NextResponse.json({ chat });
}
