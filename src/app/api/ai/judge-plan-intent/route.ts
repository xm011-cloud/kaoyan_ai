import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson } from "@/lib/ai-config";

/**
 * 计划意图判断（0.4b / D4 种子）
 *
 * 探索期（无考研目标）用户描述需求 → AI 判断计划类型：
 *   kaoyan（考研备考）/ course（课程/期末）/ selfstudy（自学某科目或技能）
 * 生成前由前端展示确认卡："将生成【X 计划】· 科目…" 让用户知道在干什么。
 */

export type PlanIntentType = "kaoyan" | "course" | "selfstudy";

export interface PlanIntent {
  type: PlanIntentType;
  summary: string;
  subjects?: string[];
  /** 是否提到考试日期（kaoyan/course 时有用） */
  mentionsExamDate?: boolean;
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

    const prompt = `你是一个学习规划助手。用户描述了一个学习需求，请判断他想生成哪种计划。

用户描述：${description}

判断规则：
- kaoyan（考研备考）：提到考研、目标院校/专业、或考研科目（政治/英语一/英语二/数学一/数学二/数学三/408/专业课等）
- course（课程/期末）：提到学校课程、期末、某门课要考高分
- selfstudy（自学）：想自学某个科目/技能/考证（四六级/雅思/教资等）
- 有歧义时取最可能的，不要反问

返回 JSON，不要返回其他内容：
{"type":"kaoyan|course|selfstudy","summary":"一句话复述用户的计划需求（供用户确认，如：考研备考，政治英语一数学一408）","subjects":["推测要学的科目名（3-5个，从描述推断；不确定就给最可能的公共课/科目）"],"mentionsExamDate":true|false}`;

    const result = await callAI(aiConfig, {
      messages: [
        { role: "system", content: "你是简洁的学习规划助手，只返回 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 1024,
    });

    const parsed = extractJson<PlanIntent>(result.text || "");
    if (!parsed || !["kaoyan", "course", "selfstudy"].includes(parsed.type)) {
      return jsonNoStore({ error: "计划类型判断失败，请重试" }, { status: 500 });
    }

    return jsonNoStore({
      intent: {
        type: parsed.type,
        summary: parsed.summary || description,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects.slice(0, 5) : [],
        mentionsExamDate: Boolean(parsed.mentionsExamDate),
      } satisfies PlanIntent,
    });
  } catch (err) {
    return handleApiError(err, "判断计划类型");
  }
}
