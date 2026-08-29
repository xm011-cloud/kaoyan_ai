import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson, type AiConfig } from "@/lib/ai-config";

/**
 * 计划意图判断（0.4b / D4 种子）
 *
 * 探索期（无考研目标）用户描述需求 → AI 判断计划类型：
 *   kaoyan（考研备考）/ course（课程/期末）/ selfstudy（自学某科目或技能）
 * 生成前由前端展示确认卡："将生成【X 计划】· 科目…" 让用户知道在干什么。
 *
 * 健壮性（2026-08-29 修复）：
 * - 读 text || reasoningText 双源（推理模型有时 content 为空、答案在思考里）
 * - 解析失败重试一次（更严格的"只输出 JSON"提示）
 * - 失败时服务端打印原始输出，便于排查
 */

export type PlanIntentType = "kaoyan" | "course" | "selfstudy";

export interface PlanIntent {
  type: PlanIntentType;
  summary: string;
  subjects?: string[];
  /** 是否提到考试日期（kaoyan/course 时有用） */
  mentionsExamDate?: boolean;
}

const VALID_TYPES: PlanIntentType[] = ["kaoyan", "course", "selfstudy"];

function buildPrompt(description: string, strict = false): string {
  if (strict) {
    // 严格模式：强制单行合法 JSON，几乎不留给模型发挥空间
    return `你的回答必须且只能是一行合法 JSON，不要 markdown、不要换行、不要解释、不要思考过程。
{"type":"kaoyan|course|selfstudy","summary":"一句话复述用户需求","subjects":["科目1","科目2","科目3"],"mentionsExamDate":true|false}

用户需求：${description}

判断规则：提到考研/目标院校/考研科目(政治/英语/数学/408等) → kaoyan；提到学校课程/期末 → course；其余自学/考证 → selfstudy。`;
  }
  return `你是一个学习规划助手。用户描述了一个学习需求，请判断他想生成哪种计划。

用户描述：${description}

判断规则：
- kaoyan（考研备考）：提到考研、目标院校/专业、或考研科目（政治/英语一/英语二/数学一/数学二/数学三/408/专业课等）
- course（课程/期末）：提到学校课程、期末、某门课要考高分
- selfstudy（自学）：想自学某个科目/技能/考证（四六级/雅思/教资等）
- 有歧义时取最可能的，不要反问

返回 JSON，不要返回其他内容：
{"type":"kaoyan|course|selfstudy","summary":"一句话复述用户的计划需求（供用户确认，如：考研备考，政治英语一数学一408）","subjects":["推测要学的科目名（3-5个，从描述推断；不确定就给最可能的公共课/科目）"],"mentionsExamDate":true|false}`;
}

async function judgeOnce(aiConfig: AiConfig, description: string, strict: boolean): Promise<PlanIntent | null> {
  const result = await callAI(aiConfig, {
    messages: [
      { role: "system", content: "你是简洁的学习规划助手，只输出 JSON。" },
      { role: "user", content: buildPrompt(description, strict) },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  // 双源：text 为空时用 reasoningText（推理模型答案可能在思考里）
  const fullContent = result.text || result.reasoningText || "";
  const parsed = extractJson<PlanIntent>(fullContent);
  if (parsed && VALID_TYPES.includes(parsed.type)) {
    return {
      type: parsed.type,
      summary: parsed.summary || description,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects.slice(0, 5) : [],
      mentionsExamDate: Boolean(parsed.mentionsExamDate),
    };
  }

  // 容错：文本里能明确识别类型关键词时，不阻断流程
  const t = fullContent.toLowerCase();
  if (t.includes("kaoyan") || /考研|目标院校/.test(fullContent)) {
    return { type: "kaoyan", summary: description, subjects: [], mentionsExamDate: false };
  }
  if (t.includes("course") || /课程|期末/.test(fullContent)) {
    return { type: "course", summary: description, subjects: [], mentionsExamDate: false };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const aiConfig = await getUserAiConfig(user!.id);
  if (!aiConfig) {
    return jsonNoStore(
      { error: "判断计划类型需要 AI，请先在设置页配置 AI Key" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const description = (body.description || "").trim();
    if (!description) {
      return jsonNoStore({ error: "请描述你想学什么" }, { status: 400 });
    }
    if (description.length > 300) {
      return jsonNoStore({ error: "描述太长，请控制在 300 字以内" }, { status: 400 });
    }

    // 正常模式 + 失败重试一次（严格模式）
    let intent: PlanIntent | null = null;
    try {
      intent = await judgeOnce(aiConfig, description, false);
    } catch (e) {
      console.error("judge-plan-intent AI error:", e instanceof Error ? e.message : String(e));
    }
    if (!intent) {
      try {
        console.warn("judge-plan-intent: 首次解析失败，重试严格模式。描述:", description);
        intent = await judgeOnce(aiConfig, description, true);
      } catch (e) {
        console.error("judge-plan-intent retry error:", e instanceof Error ? e.message : String(e));
      }
    }

    if (!intent) {
      console.error("judge-plan-intent: 两次都失败（无法解析 AI 输出）");
      return jsonNoStore(
        { error: "AI 返回格式异常，请重试；若反复失败，可在设置里换个模型试试" },
        { status: 500 }
      );
    }

    return jsonNoStore({ intent });
  } catch (err) {
    return handleApiError(err, "判断计划类型");
  }
}
