import { prisma } from "@/lib/prisma";

export interface AiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  /** 驾驶模式三档：auto / assisted / manual（服务端直读，无需客户端传参） */
  drivingMode?: "auto" | "assisted" | "manual";
}

// ── OpenAI Function Calling 类型 ──

export interface AiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

const GLOBAL_DEFAULTS = {
  baseURL: "https://api.xiaomimimo.com/v1",
  model: "mimo-v2.5-pro",
};

export async function getUserAiConfig(userId: string): Promise<AiConfig | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiKey: true, aiUrl: true, aiModel: true, drivingMode: true },
  });

  const drivingMode = (dbUser?.drivingMode as AiConfig["drivingMode"]) || "assisted";

  // 用户配了自己的 key → 优先用
  if (dbUser?.aiKey) {
    return {
      apiKey: dbUser.aiKey,
      baseURL: dbUser.aiUrl || GLOBAL_DEFAULTS.baseURL,
      model: dbUser.aiModel || GLOBAL_DEFAULTS.model,
      drivingMode,
    };
  }

  // 回退到全局 key
  const globalKey = process.env.OPENAI_API_KEY;
  if (globalKey && !globalKey.startsWith("your_")) {
    return {
      apiKey: globalKey,
      baseURL: process.env.OPENAI_BASE_URL || GLOBAL_DEFAULTS.baseURL,
      model: process.env.AI_MODEL || GLOBAL_DEFAULTS.model,
      drivingMode,
    };
  }

  return null; // 没配置
}

// ── 统一的 AI 调用工具 ──

export interface AiCallOptions {
  messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string; tool_calls?: AiToolCall[] }>;
  temperature?: number;
  maxTokens?: number;
  tools?: AiTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface AiCallResult {
  text: string;
  reasoningText?: string;
  toolCalls?: AiToolCall[];
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
  const body: Record<string, unknown> = {
    model: config.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice ?? "auto";
  }

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errBody = "";
    try {
      errBody = await response.text();
    } catch {
      // ignore
    }
    const err = new Error(`AI API error: ${response.status}`) as Error & {
      status: number;
      body: string;
    };
    err.status = response.status;
    err.body = errBody;
    throw err;
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const text = message?.content || "";
  const reasoningText = message?.reasoning_content || "";

  // 解析 tool_calls
  let toolCalls: AiCallResult["toolCalls"];
  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    toolCalls = message.tool_calls.map((tc: Record<string, unknown>) => ({
      id: tc.id as string,
      type: (tc.type as "function") || "function",
      function: {
        name: (tc.function as Record<string, unknown>).name as string,
        arguments: (tc.function as Record<string, unknown>).arguments as string,
      },
    }));
  }

  return { text, reasoningText: reasoningText || undefined, toolCalls };
}

/** 截断 AI 思考过程（避免回传过长，前端只需摘要 + 展开全程） */
export function truncateReasoning(reasoning: string | undefined, max = 1500): string | undefined {
  if (!reasoning) return undefined;
  return reasoning.length > max ? reasoning.slice(0, max) + "…" : reasoning;
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
