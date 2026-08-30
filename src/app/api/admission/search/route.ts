import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson } from "@/lib/ai-config";
import { searchWeb, fetchPageContent } from "@/lib/search";
import { isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { toEntryViews } from "@/lib/admission-server";
import { aggregateRows } from "@/lib/admission";

function findLibrary(university: string, major: string, year?: number) {
  return prisma.admissionInfo.findMany({
    where: {
      university: { contains: university },
      ...(major ? { major: { contains: major } } : {}),
      ...(year ? { year } : {}),
    },
    orderBy: [{ year: "desc" }, { createdAt: "asc" }],
  });
}

// POST: 搜索院校录取信息
// 1. 先查社区知识库（无需 AI Key，命中秒回）
// 2. 未命中 → 联网爬取 + AI 提取 → 成功落库为全局数据（unverified，标注来源）
// 3. 空结果不落库
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  if (isRateLimited(request, { feature: "admission-search", max: 5 })) {
    return jsonNoStore({ error: "操作太频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { university, major = "", year, refresh } = body;

    if (!university) {
      return jsonNoStore({ error: "请输入院校名称" }, { status: 400 });
    }

    // ── 1. 查库（refresh=true 时跳过，强制联网）──
    if (refresh !== true) {
      const libRows = await findLibrary(university, major, year || undefined);
      if (libRows.length > 0) {
        const entries = await toEntryViews(libRows, user!.id);
        return jsonNoStore({
          library: true,
          university,
          major: entries[0]?.major || major,
          year: year || null,
          entries,
          aggregated: aggregateRows(entries),
          rawResults: [],
          disclaimer:
            "以下数据来自社区知识库（多来源并存），请以官方公布为准。对数据有疑问可点击「质疑」反馈。",
        });
      }
    }

    // ── 2. 未命中 → 联网搜索（必应主力，带核心词相关性过滤）──
    const yearStr = year ? `${year}年` : "";
    const queries = [
      `${university} ${major} 考研 ${yearStr} 复试分数线 录取最低分`,
      `${university} ${major} 考研 ${yearStr} 招生人数 报录比`,
      `${university} ${major} 考研 ${yearStr} 考试科目 参考书目`,
    ];
    // 相关性核心词：院校名 + 专业词（过滤必应分词不准带来的无关结果）
    const mustInclude = [university, ...major.trim().split(/[\s,，、]+/)];

    const allResults: { query: string; results: Awaited<ReturnType<typeof searchWeb>> }[] = [];
    for (const q of queries) {
      const results = await searchWeb(q, 5, { mustInclude });
      allResults.push({ query: q, results });
    }

    const contextParts: string[] = [];
    const sources: string[] = [];

    for (const { results } of allResults) {
      for (const r of results.slice(0, 3)) {
        contextParts.push(`[来源: ${r.title}]\nURL: ${r.url}\n摘要: ${r.snippet}`);
        sources.push(r.url);
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

    const aiConfig = await getUserAiConfig(user!.id);

    // 有联网结果但没配 AI → 提示配置（不再返回残废结果）
    if (hasWebResults && !aiConfig) {
      return jsonNoStore({
        library: false,
        university,
        major,
        year: year || null,
        entries: [],
        aggregated: [],
        rawResults: allResults.flatMap((r) =>
          r.results.slice(0, 3).map((s) => ({ ...s, query: r.query }))
        ),
        needAI: true,
        disclaimer: "未配置 AI，无法提取结构化数据。配置 AI 后搜索会自动入库与大家共享。",
      });
    }

    // ── 3. AI 提取（基于网页，可落库）──
    let structuredEntries: {
      year: number;
      category: string;
      data: Record<string, unknown>;
      source: string;
    }[] = [];

    if (aiConfig && hasWebResults) {
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
        const parsed = extractJson<{ entries?: Record<string, unknown>[] }>(
          result.text || result.reasoningText || ""
        );
        if (parsed?.entries) {
          structuredEntries = parsed.entries
            .filter((e) => ["score_line", "enrollment", "subjects", "tuition", "notes"].includes(String(e.category)))
            .map((e) => ({
              year: typeof e.year === "number" ? e.year : year || new Date().getFullYear(),
              category: String(e.category),
              data: { ...(e.data as Record<string, unknown>), notes: e.notes || undefined },
              source: String(e.source || sources[0] || ""),
            }));
        }
      } catch {
        // AI extraction failed
      }
    }

    // ── 4. 落库（仅基于网页提取的数据；AI 知识库兜底不落库）──
    const savedCount: Record<string, number> = {};
    for (const entry of structuredEntries) {
      const exists = await prisma.admissionInfo.findFirst({
        where: {
          university: { equals: university, mode: "insensitive" },
          major,
          year: entry.year,
          category: entry.category,
          source: entry.source || "",
        },
      });
      if (!exists) {
        try {
          await prisma.admissionInfo.create({
            data: {
              userId: null, // 全局共享
              university,
              major,
              year: entry.year,
              category: entry.category,
              data: entry.data as unknown as Prisma.InputJsonValue,
              source: entry.source,
              verifyStatus: "unverified",
            },
          });
          savedCount[entry.category] = (savedCount[entry.category] || 0) + 1;
        } catch {
          // 并发冲突等，跳过
        }
      }
    }

    // ── 5. 返回（落库后回查一次，让用户立即看到入库结果）──
    const rows = await findLibrary(university, major, year || undefined);
    const entries = await toEntryViews(rows, user!.id);

    return jsonNoStore({
      library: rows.length > 0,
      university,
      major,
      year: year || null,
      entries,
      aggregated: aggregateRows(entries),
      rawResults: allResults.flatMap((r) =>
        r.results.slice(0, 3).map((s) => ({ ...s, query: r.query }))
      ),
      savedNew: savedCount,
      disclaimer: "数据来源于公开网络搜索（已标注来源），仅供参考。请以官方公布为准。",
    });
  } catch (err) {
    console.error("Admission search error:", err);
    return jsonNoStore({ error: "搜索失败，请稍后重试" }, { status: 500 });
  }
}
