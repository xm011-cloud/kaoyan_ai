import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI } from "@/lib/ai-config";
import type { AiToolCall } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { searchMaterials, buildRagContext, findRelevantSegments } from "@/lib/rag";
import { getToolDefinitions, executeTool } from "@/lib/ai-tools";

const MAX_TOOL_ITERATIONS = 5;

// ── 前端操作卡片类型 ──
interface ActionCard {
  type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated";
  title: string;
  detail: string;
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const aiConfig = await getUserAiConfig(user!.id);
  if (!aiConfig) {
    return jsonNoStore({
      reply: "请先在设置页面配置你的 AI API Key（支持 MiMo、DeepSeek、通义千问等兼容 OpenAI 接口的服务）后，才能使用 AI 问答功能。",
      needConfig: true,
    });
  }

  try {
    const body = await request.json();
    const { messages, materialIds } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonNoStore({ error: "消息格式不正确" }, { status: 400 });
    }

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

    // 构建系统提示词（含 RAG + 工具使用指引）
    let systemContent = `你是 AI 考研助手，专门帮助用户备考研究生入学考试。请用中文回复，要专业、清晰、有条理。${selectedLabel}

## 可用功能
你可以使用工具来帮助用户完成以下操作：
- **查询数据**：查看今日任务、打卡状态、考研目标、待复习错题、本周学习统计
- **执行操作**：创建新任务、切换任务完成状态、创建学习打卡、设置学习提醒

使用规则：
1. 当用户询问学习数据时（如"今天有什么任务"、"打卡了吗"、"本周学了多久"），先调用对应的查询工具获取实时数据，再基于数据回答
2. 只有在用户明确要求执行操作时才调用写入工具（如"帮我创建一个任务"、"帮我打卡"、"设置提醒"）
3. 执行写入操作后，用自然语言告知用户操作结果
4. 如果工具执行失败（返回 error），向用户说明情况并提供替代建议
5. 不要编造数据——始终基于工具返回的真实数据回答`;

    if (ragContext) {
      systemContent += `\n\n## 用户上传的相关资料\n${ragContext}\n\n请在回答中引用资料内容，并注明是哪份资料。${materialIds?.length > 0 ? "用户已指定用这些资料回答，请严格基于这些内容。若无相关内容请诚实告知。" : ""}`;
    } else if (userMaterials.length > 0) {
      systemContent += `\n\n用户已上传 ${userMaterials.length} 份学习资料，但未找到相关内容。`;
    }

    // ── 构建 API messages ──
    // 只保留用户和助手的对话消息，系统消息单独构建
    const conversationMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const apiMessages: Array<{ role: string; content: string; tool_call_id?: string; name?: string; tool_calls?: AiToolCall[] }> = [
      { role: "system", content: systemContent },
      ...conversationMessages,
    ];

    // ── Tool Calling 循环 ──
    const actions: ActionCard[] = [];
    let reply = "";

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      let result;
      try {
        result = await callAI(aiConfig, {
          messages: apiMessages,
          temperature: 0.7,
          maxTokens: 4096,
          tools: getToolDefinitions(),
          tool_choice: "auto",
        });
      } catch (aiErr) {
        const err = aiErr as Error & { status?: number };
        if (err.status === 401 || err.status === 403) {
          return jsonNoStore({ reply: "AI API Key 无效或已过期，请在设置页面更新。", needConfig: true });
        }
        throw aiErr;
      }

      // 没有 tool_calls → AI 返回了最终文本
      if (!result.toolCalls || result.toolCalls.length === 0) {
        reply = result.text || "抱歉，我暂时无法回答。";
        break;
      }

      // ── 有 tool_calls → 执行工具并注入结果 ──

      // 1. 添加 assistant 消息（含 tool_calls）
      apiMessages.push({
        role: "assistant",
        content: result.text || "",
        tool_calls: result.toolCalls,
      });

      // 2. 执行每个 tool call
      for (const tc of result.toolCalls) {
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {
          parsedArgs = {};
        }

        const toolResult = await executeTool(user!.id, tc.function.name, parsedArgs);

        // 添加 tool 结果消息
        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: toolResult.result,
        });

        // 收集写操作卡片
        if (toolResult.actionCard) {
          actions.push(toolResult.actionCard);
        }
      }

      // 最后迭代 → 如果 AI 还在调工具，强制结束
      if (i === MAX_TOOL_ITERATIONS - 1) {
        // 再调一次让 AI 总结
        try {
          const finalResult = await callAI(aiConfig, {
            messages: apiMessages,
            temperature: 0.7,
            maxTokens: 2048,
          });
          reply = finalResult.text || "操作已完成，请查看结果。";
        } catch {
          reply = `已完成 ${actions.length} 项操作，请查看上方卡片确认。`;
        }
      }
    }

    // 如果循环结束仍未得到 reply（极端情况：AI 始终返回 tool_calls）
    if (!reply) {
      reply = `已完成 ${actions.length} 项操作，请查看上方卡片确认。`;
    }

    return jsonNoStore({
      reply,
      actions: actions.length > 0 ? actions : undefined,
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
    return jsonNoStore({ reply: "AI 服务暂时不可用，请稍后再试。" });
  }
}
