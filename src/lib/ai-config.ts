import { prisma } from "@/lib/prisma";

export interface AiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

const GLOBAL_DEFAULTS = {
  baseURL: "https://api.xiaomimimo.com/v1",
  model: "mimo-v2.5-pro",
};

export async function getUserAiConfig(userId: string): Promise<AiConfig | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiKey: true, aiUrl: true, aiModel: true },
  });

  // 用户配了自己的 key → 优先用
  if (dbUser?.aiKey) {
    return {
      apiKey: dbUser.aiKey,
      baseURL: dbUser.aiUrl || GLOBAL_DEFAULTS.baseURL,
      model: dbUser.aiModel || GLOBAL_DEFAULTS.model,
    };
  }

  // 回退到全局 key
  const globalKey = process.env.OPENAI_API_KEY;
  if (globalKey && !globalKey.startsWith("your_")) {
    return {
      apiKey: globalKey,
      baseURL: process.env.OPENAI_BASE_URL || GLOBAL_DEFAULTS.baseURL,
      model: process.env.AI_MODEL || GLOBAL_DEFAULTS.model,
    };
  }

  return null; // 没配置
}

// ── 统一的 AI 调用工具 ──

export interface AiCallOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface AiCallResult {
  text: string;
  reasoningText?: string;
}

/**
 * 统一的 AI API 调用函数。处理 fetch + 错误 + 响应解析，
 * 返回原始文本和推理内容，由调用方自行处理 JSON 提取等逻辑。
 *
 * @throws {Error} 返回的 error 包含 `status` 和 `body` 属性供调用方判断
 */
export async function callAI(
  config: AiConfig,
  options: AiCallOptions
): Promise<AiCallResult> {
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // ignore
    }
    const err = new Error(`AI API error: ${response.status}`) as Error & {
      status: number;
      body: string;
    };
    err.status = response.status;
    err.body = body;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const reasoningText = data.choices?.[0]?.message?.reasoning_content || "";
  return { text, reasoningText: reasoningText || undefined };
}

/** 从 AI 返回文本中提取 JSON 对象 */
export function extractJson<T = unknown>(text: string): T | null {
  // 去掉 markdown 代码块标记
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** 从 AI 返回文本中提取 JSON 数组 */
export function extractJsonArray<T = unknown>(text: string): T[] | null {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T[];
  } catch {
    return null;
  }
}
