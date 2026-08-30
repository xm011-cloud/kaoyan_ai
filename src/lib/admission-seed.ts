/**
 * 院校情报批量补全 — 搜索(必应/Tavily) + AI 提取 + 落库(全局共享)。
 * 供 scripts/seed-admission.mjs 批量填库使用；与 search/route.ts 逻辑同源但面向批量：
 * 无用户态、不限流、可循环、可断点续跑（同源去重）。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchWeb, fetchPageContent } from "@/lib/search";
import { callAI, extractJson } from "@/lib/ai-config";

export interface SeedAiConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface SeedEntry {
  year: number;
  category: string;
  data: Record<string, unknown>;
  source: string;
}

export interface SeedResult {
  university: string;
  major: string;
  /** 本次新增入库条数 */
  saved: number;
  entries: SeedEntry[];
  error?: string;
}

const CATEGORIES = ["score_line", "enrollment", "subjects", "tuition", "notes"];

/** 同源去重：完全相同的 (university, major, year, category, source) 已存在则跳过 */
async function entryExists(e: SeedEntry, university: string, major: string): Promise<boolean> {
  const found = await prisma.admissionInfo.findFirst({
    where: {
      university,
      major,
      year: e.year,
      category: e.category,
      source: e.source || "",
    },
  });
  return !!found;
}

export async function searchAndSaveAdmission(
  opts: {
    university: string;
    major?: string;
    year?: number;
    ai: SeedAiConfig;
    log?: (msg: string) => void;
  }
): Promise<SeedResult> {
  const { university, major = "", year, ai } = opts;
  const log = opts.log || (() => {});
  const base: SeedResult = { university, major, saved: 0, entries: [] };

  try {
    const yearStr = year ? `${year}年` : "";
    const queries = [
      `${university} ${major} 考研 ${yearStr} 复试分数线 录取最低分`,
      `${university} ${major} 考研 ${yearStr} 招生人数 报录比`,
      `${university} ${major} 考研 ${yearStr} 考试科目 参考书目`,
    ];
    const mustInclude = [university, ...major.trim().split(/[\s,，、]+/)].filter(Boolean);

    const allResults: { results: Awaited<ReturnType<typeof searchWeb>> }[] = [];
    for (const q of queries) {
      const results = await searchWeb(q, 5, { mustInclude });
      allResults.push({ results });
    }

    const contextParts: string[] = [];
    const sources: string[] = [];
    for (const { results } of allResults) {
      for (const r of results.slice(0, 3)) {
        contextParts.push(`[来源: ${r.title}]\nURL: ${r.url}\n摘要: ${r.snippet}`);
        sources.push(r.url);
        if (contextParts.length <= 2) {
          const content = await fetchPageContent(r.url);
          if (content) contextParts.push(`[页面内容]\n${content.slice(0, 3000)}`);
        }
      }
    }
    const webContext = contextParts.join("\n\n---\n\n");
    if (webContext.length <= 50) {
      return { ...base, error: "无搜索结果" };
    }

    const result = await callAI(ai, {
      messages: [
        {
          role: "system",
          content:
            "你是一个考研数据提取专家。你只返回JSON对象，不返回任何其他内容、不解释、不复述指令。如果搜索结果中没有任何可提取的数据，就返回 {\"entries\": []}。严禁编造数据。",
        },
        {
          role: "user",
          content: `请从以下搜索结果中提取关于「${university}${major ? " " + major : ""}」的考研录取信息。

要求：
1. **必须标注数据年份**（如 2025、2024）。如果某条信息没有明确年份，标注 "year_unknown"。
2. 提取所有可验证的分数、人数、科目等数字信息
3. 不要编造任何数据——搜索结果中没有的就不要提取
4. 每条数据标注来源 URL
5. **如果搜索结果里没有任何分数线/招生/科目数据，直接返回 {"entries": []}**，不要解释

## 搜索结果
${webContext.slice(0, 8000)}

## 输出格式（只返回JSON）
{
  "university": "${university}",
  "major": "${major || "待确认"}",
  "entries": [
    { "year": 2025, "category": "score_line", "scores": { "总分": 350, "政治": 60, "英语": 60, "数学": 90, "专业课": 90 }, "source": "来源URL", "notes": "备注" },
    { "year": 2025, "category": "enrollment", "enrollmentQuota": 50, "applicants": 300, "source": "来源URL", "notes": "" },
    { "year": 2025, "category": "subjects", "subjects": ["政治", "英语一", "数学一", "专业课名称"], "source": "来源URL", "notes": "" }
  ]
}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 4096,
    });

    const parsed = extractJson<{ entries?: Record<string, unknown>[] }>(
      result.text || result.reasoningText || ""
    );
    if (!parsed?.entries) {
      return { ...base, error: "AI 未提取到结构化数据" };
    }

    const entries: SeedEntry[] = parsed.entries
      .filter((e) => CATEGORIES.includes(String(e.category)))
      .map((e) => ({
        year: typeof e.year === "number" ? e.year : year || new Date().getFullYear(),
        category: String(e.category),
        data: {
          ...(e.data as Record<string, unknown>),
          notes: (e.notes as string | undefined) || undefined,
        },
        source: String(e.source || sources[0] || ""),
      }));

    // 去重落库
    let saved = 0;
    for (const e of entries) {
      if (await entryExists(e, university, major)) continue;
      try {
        await prisma.admissionInfo.create({
          data: {
            userId: null, // 全局共享
            university,
            major,
            year: e.year,
            category: e.category,
            data: e.data as unknown as Prisma.InputJsonValue,
            source: e.source,
            verifyStatus: "unverified",
          },
        });
        saved++;
      } catch {
        // 并发冲突等，跳过
      }
    }
    log(`  ✅ ${university} ${major} 新增 ${saved} 条（共提取 ${entries.length}）`);
    return { university, major, saved, entries };
  } catch (e) {
    log(`  ⚠️ ${university} ${major} 失败: ${e instanceof Error ? e.message : String(e)}`);
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}
