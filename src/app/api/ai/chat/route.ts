import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, truncateReasoning } from "@/lib/ai-config";
import type { AiToolCall } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { searchMaterials, buildRagContext, findRelevantSegments } from "@/lib/rag";
import { getToolDefinitions, getSkillRunTools, executeTool, isSkillFinishCall } from "@/lib/ai-tools";
import { buildChatSystemPrompt } from "@/lib/ai-prompts";
import {
  parseSkillSteps,
  buildSkillDataSnapshot,
  buildSkillRunPrompt,
  getNoteDigest,
  skillFinish,
} from "@/lib/skills";

const MAX_TOOL_ITERATIONS = 5;

/** 新建对话时的种子消息（仅 role/content，去掉 id 等客户端字段） */
function conversationSeedMessages(messages: Array<{ role?: string; content?: unknown }>) {
  return messages
    .filter((m) => m && typeof m.content === "string")
    .map((m, idx) => ({
      id: `seed_${idx}`,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content as string,
    }));
}

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
    const { messages, materialIds, chatId: bodyChatId, floating, skillId: bodySkillId } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonNoStore({ error: "消息格式不正确" }, { status: 400 });
    }

    // 对话→任务落地：沿用已有对话（提案挂到它的 pendingProposal）；无对话时先建一条
    let resolvedChatId: string | null = typeof bodyChatId === "string" && bodyChatId ? bodyChatId : null;
    let proposalData: Record<string, unknown> | null = null;

    const lastMessage = messages[messages.length - 1]?.content || "";

    // ── 技能模式：技能运行 = 带 skillId 的对话 ──
    // 解析技能：优先 body.skillId；否则从已解析 chat 找回（技能已删则回落普通对话）
    let activeSkill: {
      id: string;
      name: string;
      icon: string;
      description?: string;
      steps: ReturnType<typeof parseSkillSteps>;
      note: unknown;
    } | null = null;

    let skillId: string | null =
      typeof bodySkillId === "string" && bodySkillId ? bodySkillId : null;
    if (!skillId && resolvedChatId) {
      const chatWithSkill = await prisma.chat.findUnique({
        where: { id: resolvedChatId },
        select: { skillId: true },
      });
      skillId = chatWithSkill?.skillId ?? null;
    }
    if (skillId) {
      const skill = await prisma.skill.findFirst({ where: { id: skillId, userId: user!.id } });
      if (skill) {
        activeSkill = {
          id: skill.id,
          name: skill.name,
          icon: skill.icon,
          description: skill.description ?? undefined,
          steps: parseSkillSteps(skill.steps),
          note: skill.note,
        };
      }
    }

    // 技能启动：无对话先建带 skillId 的 Chat（供 executeTool 的 ctx.skillId / pendingProposal 承载）
    if (activeSkill && !resolvedChatId) {
      const chat = await prisma.chat.create({
        data: {
          userId: user!.id,
          skillId: activeSkill.id,
          messages: conversationSeedMessages(messages),
        },
      });
      resolvedChatId = chat.id;
    }

    // 用户手动结束技能：直接收尾，不走 AI
    const trimmedLast = String(lastMessage || "").trim();
    if (activeSkill && /^(结束技能|完成技能)$/.test(trimmedLast)) {
      await skillFinish(user!.id, activeSkill.id);
      return jsonNoStore({
        reply: `已结束「${activeSkill.name}」技能运行 👋`,
        skillRun: { id: activeSkill.id, name: activeSkill.name, icon: activeSkill.icon, completed: true },
      });
    }
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

    // 构建系统提示词（角色宪章/表达规范/使用边界共享层 + RAG + 工具使用指引）
    let systemContent = buildChatSystemPrompt({
      selectedLabel,
      ragContext: ragContext || undefined,
      userMaterialsCount: userMaterials.length,
      materialIdsSpecified: (materialIds?.length ?? 0) > 0,
      drivingMode: aiConfig.drivingMode,
      floating: !!floating,
    });

    // 技能模式：注入技能流程 prompt + 数据快照 + 档案
    let skillComplete = false;
    if (activeSkill) {
      const dataSources = activeSkill.steps
        .filter((s) => s.type === "data")
        .flatMap((s) => (s.type === "data" ? s.sources : []));
      const snapshot =
        dataSources.length > 0 ? await buildSkillDataSnapshot(user!.id, dataSources) : "";
      const noteDigest = getNoteDigest(activeSkill.note);
      systemContent +=
        "\n\n" +
        buildSkillRunPrompt({
          name: activeSkill.name,
          description: activeSkill.description,
          steps: activeSkill.steps,
          snapshot,
          noteDigest,
        });
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
    let replyReasoning = ""; // 产出最终回复那次的思考过程

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      let result;
      try {
        result = await callAI(aiConfig, {
          messages: apiMessages,
          temperature: 0.7,
          maxTokens: 4096,
          tools: activeSkill ? getSkillRunTools() : getToolDefinitions(),
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
        replyReasoning = result.reasoningText || "";
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

        // 提案工具需要先有对话承载 pendingProposal（无对话则先建一条）
        if (tc.function.name === "propose_tasks" && !resolvedChatId) {
          const chat = await prisma.chat.create({
            data: {
              userId: user!.id,
              messages: conversationMessages.map((m, idx) => ({
                id: `seed_${idx}`,
                role: m.role,
                content: m.content,
              })),
            },
          });
          resolvedChatId = chat.id;
        }

        const toolResult = await executeTool(user!.id, tc.function.name, parsedArgs, {
          chatId: resolvedChatId,
          skillId: activeSkill?.id ?? null,
        });

        // 技能收尾：AI 调用 skill_control(finish) → 标记本次运行完成
        if (isSkillFinishCall(tc.function.name, parsedArgs)) {
          skillComplete = true;
        }

        // 捕获提案数据（前端渲染确认卡；pendingProposal 已由工具执行器挂到对话）
        if (tc.function.name === "propose_tasks") {
          try {
            const parsed = JSON.parse(toolResult.result);
            if (parsed.success && parsed.action === "wait_for_confirmation") {
              proposalData = parsed;
            }
          } catch {
            // ignore
          }
        }

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
          replyReasoning = finalResult.reasoningText || "";
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
      reasoning: truncateReasoning(replyReasoning),
      chatId: resolvedChatId || undefined,
      proposal: proposalData || undefined,
      actions: actions.length > 0 ? actions : undefined,
      skillRun: activeSkill
        ? { id: activeSkill.id, name: activeSkill.name, icon: activeSkill.icon, completed: skillComplete }
        : undefined,
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
