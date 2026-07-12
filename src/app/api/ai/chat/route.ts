import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { searchMaterials, buildRagContext, findRelevantSegments } from "@/lib/rag";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { messages, materialIds } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "消息格式不正确" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || "https://api.xiaomimimo.com/v1";
    const model = process.env.AI_MODEL || "mimo-v2.5-pro";

    if (!apiKey || apiKey.startsWith("your_")) {
      return NextResponse.json({
        reply: "AI 服务尚未配置。请在 .env 文件中设置 OPENAI_API_KEY 后再试。",
      });
    }

    // ── RAG: 检索相关资料 ──
    const lastMessage = messages[messages.length - 1]?.content || "";
    const materialWhere: Record<string, unknown> = { userId: user!.id };

    // 如果前端指定了要引用的资料 ID 列表，只搜索这些
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      materialWhere.id = { in: materialIds };
    }

    const userMaterials = await prisma.material.findMany({
      where: materialWhere,
      select: { id: true, name: true, content: true },
    });

    const searchResults = await searchMaterials(lastMessage, userMaterials);
    let ragContext = buildRagContext(searchResults);

    // 如果用户指定了引用资料但搜索没匹配到，直接把选中资料全部注入
    if (!ragContext && materialIds?.length > 0 && userMaterials.length > 0) {
      ragContext = userMaterials
        .filter(m => m.content && m.content.length > 10)
        .map((m, i) => `[资料${i + 1}: ${m.name}]\n${m.content!.slice(0, 4000)}`)
        .join("\n\n---\n\n");
    }

    // ── 构建提示词 ──
    const selectedLabel = materialIds?.length > 0 ? `（用户指定了 ${materialIds.length} 份资料）` : "";
    let systemContent = `你是 AI 考研助手，专门帮助用户备考研究生入学考试。你可以解答专业课问题、解析考试难点、提供学习建议。请用中文回复，回复要专业、清晰、有条理。${selectedLabel}`;

    if (ragContext) {
      systemContent += `\n\n## 用户上传的相关资料\n以下是用户上传的资料中与当前问题相关的内容，请优先基于这些内容回答：\n\n${ragContext}\n\n请在回答中引用资料内容，并注明是哪份资料。${materialIds?.length > 0 ? "用户已明确指定用这些资料回答，请严格基于这些资料内容。如果资料中没有相关内容，请诚实告知。" : ""}`;
    } else if (userMaterials.length > 0) {
      systemContent += `\n\n用户已上传 ${userMaterials.length} 份学习资料，但未找到与当前问题直接相关的内容。请提醒用户可以先上传相关资料，AI 就能基于资料内容精确回答。`;
    }

    const systemPrompt = { role: "system", content: systemContent };

    const apiMessages = [systemPrompt, ...messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }))];

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText.substring(0, 300));
      return NextResponse.json({
        reply: "AI 服务暂时不可用，请稍后再试。",
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答这个问题。";

    return NextResponse.json({
      reply,
      // 资料来源：优先来自搜索，如果是直接注入模式则来自 materialIds 匹配
      sources: (searchResults.length > 0
        ? searchResults
        : materialIds?.length > 0
          ? userMaterials.filter(m => m.content && m.content.length > 10).map(m => ({ id: m.id, name: m.name, content: m.content ?? "", score: 1 }))
          : [] as { id: string; name: string; content: string; score: number }[]
      ).map(r => ({
        id: r.id,
        name: r.name,
        score: Math.min(Math.round(r.score * 100), 100),
        preview: (r.content || "").slice(0, 150),
        segments: findRelevantSegments(lastMessage, r.content || "", 2),
      })),
    });
  } catch (err) {
    console.error("AI Chat error:", err);
    return NextResponse.json({
      reply: "AI 服务暂时不可用，请稍后再试。",
    });
  }
}
