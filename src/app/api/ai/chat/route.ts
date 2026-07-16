import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { searchMaterials, buildRagContext, findRelevantSegments } from "@/lib/rag";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const aiConfig = await getUserAiConfig(user!.id);
  if (!aiConfig) {
    return NextResponse.json({
      reply: "请先在设置页面配置你的 AI API Key（支持 MiMo、DeepSeek、通义千问等兼容 OpenAI 接口的服务）后，才能使用 AI 问答功能。",
      needConfig: true,
    });
  }

  try {
    const body = await request.json();
    const { messages, materialIds } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "消息格式不正确" }, { status: 400 });
    }

    const { apiKey, baseURL, model } = aiConfig;
    const lastMessage = messages[messages.length - 1]?.content || "";
    const materialWhere: Record<string, unknown> = { userId: user!.id };
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      materialWhere.id = { in: materialIds };
    }

    const userMaterials = await prisma.material.findMany({
      where: materialWhere,
      select: { id: true, name: true, content: true },
    });

    const searchResults = await searchMaterials(lastMessage, userMaterials, user!.id);
    let ragContext = buildRagContext(searchResults);
    if (!ragContext && materialIds?.length > 0 && userMaterials.length > 0) {
      ragContext = userMaterials
        .filter(m => m.content && m.content.length > 10)
        .map((m, i) => `[资料${i + 1}: ${m.name}]\n${m.content!.slice(0, 4000)}`)
        .join("\n\n---\n\n");
    }

    const selectedLabel = materialIds?.length > 0 ? `（用户指定了 ${materialIds.length} 份资料）` : "";
    let systemContent = `你是 AI 考研助手，专门帮助用户备考研究生入学考试。请用中文回复，要专业、清晰、有条理。${selectedLabel}`;
    if (ragContext) {
      systemContent += `\n\n## 用户上传的相关资料\n${ragContext}\n\n请在回答中引用资料内容，并注明是哪份资料。${materialIds?.length > 0 ? "用户已指定用这些资料回答，请严格基于这些内容。若无相关内容请诚实告知。" : ""}`;
    } else if (userMaterials.length > 0) {
      systemContent += `\n\n用户已上传 ${userMaterials.length} 份学习资料，但未找到相关内容。`;
    }

    const apiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemContent },
      ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7, max_tokens: 4096 }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        return NextResponse.json({ reply: "AI API Key 无效或已过期，请在设置页面更新。", needConfig: true });
      }
      console.error("AI API error:", status);
      return NextResponse.json({ reply: "AI 服务暂时不可用，请稍后再试。" });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答。";

    return NextResponse.json({
      reply,
      sources: (searchResults.length > 0 ? searchResults
        : materialIds?.length > 0 ? userMaterials.filter(m => m.content && m.content.length > 10).map(m => ({ id: m.id, name: m.name, content: m.content ?? "", score: 1 }))
        : [] as { id: string; name: string; content: string; score: number }[]
      ).map(r => ({
        id: r.id, name: r.name,
        score: Math.min(Math.round(r.score * 100), 100),
        preview: (r.content || "").slice(0, 150),
        segments: findRelevantSegments(lastMessage, r.content || "", 2),
      })),
    });
  } catch (err) {
    console.error("AI Chat error:", err);
    return NextResponse.json({ reply: "AI 服务暂时不可用，请稍后再试。" });
  }
}
