import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { jsonNoStore } from "@/lib/api-utils";
import { getUserAiConfig, callAI, extractJson } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import type { SkillStep } from "@/lib/skill-templates";

// ── 蒸馏 prompt：把一段对话转成技能定义 ──

const STEPS_SCHEMA = `步骤类型（type，按顺序组合 2-5 步）：
- { "type": "data", "sources": ["tasks.today"] }  → 预取数据快照（sources 可多选：tasks.today / tasks.week / checkins.recent7 / checkins.week / wrongQuestions.recent / wrongQuestions.due / goal / weeklyStats / practice.recent）
- { "type": "ask", "question": "向用户提的问题" }  → 中途停下问用户，等回答再继续
- { "type": "ai", "instruction": "AI 执行的具体指令" }  → 用一句话写清楚 AI 要做什么（要具体，能产出可测结果）
- { "type": "note", "action": "append", "label": "记录标签" }  → 把成果追加到技能档案（跨会话累积）
- { "type": "finish" }  → 流程收尾（一般放最后）

参考示例：
1. 每日复盘：data[tasks.today,checkins.recent7] → ask「今天学的怎么样？」→ ai「输出 3 句今日复盘 + 明天 1 个重点」→ note → finish
2. 错题变式训练：data[wrongQuestions.recent] → ask「练哪个科目？」→ ai「从错题挑 2-3 道出同考点变式题，让用户做并逐题判分讲解」→ finish
3. 费曼抽查：data[wrongQuestions.recent] → ask「抽查哪个知识点？」→ ai「让用户用大白话讲，AI 找理解漏洞并补强」→ note → finish`;

const DISTILL_RULES = `把「用户 + 助手」的对话提炼成一个可复用的技能定义。要求：
1. 技能要能反复运行：识别对话里用户反复想做的事，去掉一次性细节。
2. name：4-8 个字的技能名，好记、贴合用途。
3. triggerKeywords：2-5 个用户常说的话，用于日后 AI 主动推荐这个技能（精确、口语化，不要空泛词）。
4. steps：按上面 schema 生成，数据/提问/AI 指令要通用化（不要写死具体日期、具体题）。
5. 只输出一个 JSON 对象，不要 markdown 代码块、不要多余文字。格式：
   { "name": "技能名", "description": "一句话说明这个技能干什么", "triggerKeywords": ["词1","词2"], "steps": [ ... ] }
6. 如果这段对话根本没有可沉淀的重复工作流（比如闲聊、一次性答疑），返回：
   { "invalid": true, "reason": "简短原因" }`;

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" && body.chatId ? body.chatId : null;
  if (!chatId) {
    return jsonNoStore({ error: "缺少对话 ID" }, { status: 400 });
  }

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user!.id },
      select: { messages: true },
    });
    if (!chat) {
      return jsonNoStore({ error: "对话不存在" }, { status: 404 });
    }

    const msgs = (Array.isArray(chat.messages) ? chat.messages : []) as Array<{
      role?: string;
      content?: unknown;
    }>;
    // 近 12 轮，去重 kickoff，单条截断，控制上下文
    const transcript = msgs
      .filter((m) => m && typeof m.content === "string")
      .map((m, i) => {
        const role = m.role === "user" ? "用户" : "助手";
        const content = (m.content as string).replace(/^运行技能「.+」$/, "（启动了一个技能）").slice(0, 500);
        return `${i + 1}. ${role}：${content}`;
      })
      .slice(-12)
      .join("\n");

    if (!transcript.trim()) {
      return jsonNoStore({ error: "这段对话没有可蒸馏的内容" }, { status: 400 });
    }

    const aiConfig = await getUserAiConfig(user!.id);
    if (!aiConfig) {
      return jsonNoStore(
        { error: "请先在设置页面配置 AI API Key，才能把对话存为技能。" },
        { status: 400 }
      );
    }

    const result = await callAI(aiConfig, {
      messages: [
        { role: "system", content: `步骤 schema：\n${STEPS_SCHEMA}\n\n${DISTILL_RULES}` },
        { role: "user", content: `对话记录：\n${transcript}\n\n请蒸馏成技能定义。` },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    const parsed = extractJson<{
      name?: unknown;
      description?: unknown;
      triggerKeywords?: unknown;
      steps?: unknown;
      invalid?: unknown;
      reason?: unknown;
    }>(result.text);

    if (!parsed) {
      return jsonNoStore({ error: "蒸馏失败，AI 没有返回可解析的结果，请重试。" }, { status: 422 });
    }
    if (parsed.invalid) {
      return jsonNoStore({
        invalid: true,
        reason: typeof parsed.reason === "string" ? parsed.reason : "这段对话不适合转成技能",
      });
    }

    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const steps: SkillStep[] = Array.isArray(parsed.steps)
      ? parsed.steps.filter(
          (s): s is SkillStep =>
            !!s &&
            typeof s === "object" &&
            typeof (s as { type?: unknown }).type === "string"
        )
      : [];

    if (!name || steps.length === 0) {
      return jsonNoStore({ invalid: true, reason: "蒸馏结果不完整，请换一段更完整的对话试试" });
    }

    return jsonNoStore({
      skill: {
        name: name.slice(0, 40),
        description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : "",
        triggerKeywords: Array.isArray(parsed.triggerKeywords)
          ? parsed.triggerKeywords.filter((k): k is string => typeof k === "string").slice(0, 20)
          : [],
        steps,
      },
    });
  } catch (err) {
    console.error("Skill distill error:", err);
    return jsonNoStore({ error: "AI 服务暂时不可用，请稍后再试。" }, { status: 502 });
  }
}
