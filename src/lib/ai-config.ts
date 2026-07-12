import { prisma } from "@/lib/prisma";

interface AiConfig {
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
