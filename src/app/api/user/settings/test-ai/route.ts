import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI } from "@/lib/ai-config";
import { jsonNoStore } from "@/lib/api-utils";

// POST: 用当前生效的 AI 配置做一次最小调用，验证 Key/URL/模型是否可用
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const aiConfig = await getUserAiConfig(user!.id);
  if (!aiConfig) {
    return jsonNoStore({ ok: false, error: "未配置 AI，请先保存 API Key" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    // 最小 chat 调用（比 /models 更通用：兼容 OpenAI 系所有服务）
    await callAI(aiConfig, {
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 8,
      temperature: 0,
    });
    return jsonNoStore({
      ok: true,
      model: aiConfig.model,
      baseURL: aiConfig.baseURL,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    const e = err as { status?: number; body?: string };
    let reason = "连接失败，请检查网络或稍后再试";
    if (e.status === 401) reason = "API Key 无效或已过期";
    else if (e.status === 403) reason = "API Key 无权访问（检查额度或权限）";
    else if (e.status === 404) reason = "模型不存在，请检查 Model 名称";
    else if (e.status === 429) reason = "请求过于频繁或额度不足";
    else if (e.status && e.status >= 500) reason = "AI 服务端错误，请稍后再试";
    else if (!e.status) reason = "网络连接失败，请检查 Base URL 与网络";
    return jsonNoStore({ ok: false, error: reason, status: e.status });
  }
}
