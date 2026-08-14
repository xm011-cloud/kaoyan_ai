import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson } from "@/lib/ai-config";
import { searchWeb, fetchPageContent } from "@/lib/search";
import { isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

// 搜索结果全局缓存 TTL：24h（考研数据一年一更，24h 足够新且显著省 AI 成本）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// 规范化查询键：university|major|year（相同查询所有人共享一条缓存）
function buildQueryKey(university: string, major: string, year: number | undefined): string {
  return [university.trim(), major.trim(), year ? String(year) : ""].join("|");
}

// POST: 搜索院校录取信息（联网 + AI 提取），带 24h 全局缓存 + 限流
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  // 生产限流：5 次/分/IP（缓存命中免费，未命中烧 AI + 爬取，需防滥用）
  if (isRateLimited(request, { feature: "admission-search", max: 5 })) {
    return jsonNoStore({ error: "操作太频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { university, major = "", year } = body;

    if (!university) {
      return jsonNoStore({ error: "请输入院校名称" }, { status: 400 });
    }

    const queryKey = buildQueryKey(university, major, year);

    // 缓存命中（24h 内）：直接返回，不爬取、不调 AI
    const cached = await prisma.admissionSearchCache.findUnique({
      where: { queryKey },
    });
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS) {
      return jsonNoStore({
        ...(cached.payload as Record<string, unknown>),
        cacheHit: true,
        cachedAt: cached.updatedAt.toISOString(),
      });
    }

    const yearStr = year ? `${year}年` : "";
    const queries = [
      `${university} ${major} 考研 ${yearStr} 复试分数线 录取最低分`,
      `${university} ${major} 考研 ${yearStr} 招生人数 报录比`,
      `${university} ${major} 考研 ${yearStr} 考试科目 参考书目`,
    ];

    // Search for admission data
    const allResults: { query: string; results: Awaited<ReturnType<typeof searchWeb>> }[] = [];
    for (const q of queries) {
      const results = await searchWeb(q, 5);
      allResults.push({ query: q, results });
    }

    // Collect snippets and try to fetch page content for top results
    const contextParts: string[] = [];
    const sources: string[] = [];

    for (const { results } of allResults) {
      for (const r of results.slice(0, 3)) {
        contextParts.push(
          `[来源: ${r.title}]\nURL: ${r.url}\n摘要: ${r.snippet}`
        );
        sources.push(r.url);

        // Try to get full page content for top result
        if (contextParts.length <= 2) {
          const content = await fetchPageContent(r.url);
          if (content) {
            contextParts.push(`[页面内容]\n${content.slice(0, 3000)}`);
          }
        }
      }
    }

    const webContext = contextParts.join("\n\n---\n\n");
    const hasWebResults = webContext.length > 50;

    // Use AI to extract structured data
    const aiConfig = await getUserAiConfig(user!.id);
    let structuredData: Record<string, unknown> | null = null;

    // If search returned no results, ask AI directly with a disclaimer
    if (!hasWebResults && aiConfig) {
      try {
        const result = await callAI(aiConfig, {
          messages: [
            {
              role: "system",
              content:
                "你是一个考研信息助手。请基于你的训练数据提供信息，但必须明确标注你不确定的地方。只返回JSON。",
            },
            {
              role: "user",
              content: `请提供你已知的关于「${university}${major ? " " + major : ""}」的考研信息（${year || "近年"}）。

注意：你提供的是训练数据中的信息，可能已过时或不准确，必须如实标注。

## 输出格式（只返回JSON）
{
  "university": "${university}",
  "major": "${major || "待确认"}",
  "entries": [
    {"year": ${year || 2025}, "category": "score_line", "scores": {"总分": "请填写或填null"}, "source": "AI训练数据（非联网结果，可能不准确）", "notes": "AI模型知识库数据，请务必以官网公告为准"},
    {"year": ${year || 2025}, "category": "subjects", "subjects": ["请填写"], "source": "AI训练数据（非联网结果，可能不准确）", "notes": ""}
  ],
  "aiDisclaimer": "以下数据来自AI模型训练知识库，非联网实时搜索。可能已过时或不准确，请务必在yz.chsi.com.cn核实。"
}`,
            },
          ],
          temperature: 0.3,
          maxTokens: 4096,
        });
        structuredData = extractJson(result.text || result.reasoningText || "");
      } catch {
        // AI fallback also failed
      }
    }

    // Normal path: extract from web results
    if (!structuredData && aiConfig && hasWebResults) {
      try {
        const result = await callAI(aiConfig, {
          messages: [
            {
              role: "system",
              content:
                "你是一个考研数据提取专家。你只返回JSON，不返回其他内容。从搜索结果中提取结构化的考研录取数据。字段不存在就填null，不准编造数据。每条数据必须标注来源URL和年份。",
            },
            {
              role: "user",
              content: `请从以下搜索结果中提取关于「${university}${major ? " " + major : ""}」的考研录取信息。

要求：
1. **必须标注数据年份**（如 2025、2024）。如果搜索结果中某条信息没有明确年份，标注 "year_unknown"。
2. 提取所有可验证的分数、人数、科目等数字信息
3. 不要编造任何数据——搜索结果中没有的就填 null
4. 每条数据标注来源 URL

## 搜索结果
${webContext.slice(0, 8000)}

## 输出格式（只返回JSON）
{
  "university": "${university}",
  "major": "${major || "待确认"}",
  "entries": [
    {
      "year": 2025,
      "category": "score_line",
      "scores": { "总分": 350, "政治": 60, "英语": 60, "数学": 90, "专业课": 90 },
      "source": "来源URL",
      "notes": "备注"
    },
    {
      "year": 2025,
      "category": "enrollment",
      "enrollmentQuota": 50,
      "applicants": 300,
      "source": "来源URL",
      "notes": ""
    },
    {
      "year": 2025,
      "category": "subjects",
      "subjects": ["政治", "英语一", "数学一", "专业课名称"],
      "source": "来源URL",
      "notes": ""
    }
  ]
}`,
            },
          ],
          temperature: 0.3,
          maxTokens: 4096,
        });
        structuredData = extractJson(result.text || result.reasoningText || "");
      } catch {
        // AI extraction failed, return raw search results
      }
    }

    const aiDisclaimer =
      structuredData &&
      (structuredData as Record<string, unknown>).aiDisclaimer
        ? String((structuredData as Record<string, unknown>).aiDisclaimer)
        : "";

    const payload = {
      university,
      major,
      year: year || null,
      data: structuredData,
      rawResults: allResults.flatMap((r) =>
        r.results.slice(0, 3).map((s) => ({ ...s, query: r.query }))
      ),
      sources: [...new Set(sources)],
      fromAIKnowledge: !hasWebResults && !!structuredData,
      disclaimer:
        aiDisclaimer ||
        "数据来源于公开网络搜索，仅供参考。请以中国研究生招生信息网（yz.chsi.com.cn）和各校研究生院官网公布的信息为准。",
    };

    // 写入缓存（best-effort：写失败不影响本次返回）
    try {
      await prisma.admissionSearchCache.upsert({
        where: { queryKey },
        update: { payload: payload as unknown as Prisma.InputJsonValue },
        create: { queryKey, payload: payload as unknown as Prisma.InputJsonValue },
      });
    } catch (cacheErr) {
      console.error("Admission cache write failed:", cacheErr);
    }

    return jsonNoStore({ ...payload, cacheHit: false });
  } catch (err) {
    console.error("Admission search error:", err);
    return jsonNoStore({ error: "搜索失败，请稍后重试" }, { status: 500 });
  }
}
