import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { aggregateRows, type RawAggRow } from "@/lib/admission";
import { toEntryViews } from "@/lib/admission-server";

/**
 * GET /api/admission/library — 社区知识库院校列表（全局共享数据，userId=null）。
 * 当前数据量小：一次性拉取全局行 → 聚合 → JS 排序/分页；量大后可改 SQL groupBy 两段式。
 */
export interface SchoolSummary {
  university: string;
  majorCount: number;
  yearCount: number;
  categoryCounts: Record<string, number>;
  sourceCount: number;
  vouchCount: number;
  disputeCount: number;
  trust: number;
  latestYear: number | null;
  latestScore?: { major: string; year: number; scores: Record<string, number | string> } | null;
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const sp = new URL(request.url).searchParams;
    const university = sp.get("university")?.trim() || "";
    const major = sp.get("major")?.trim() || "";
    const year = sp.get("year") ? Number(sp.get("year")) : undefined;
    const category = sp.get("category") || "";
    const sort = (sp.get("sort") as "data" | "newest" | "trust") || "newest";
    const limit = Math.min(Math.max(Number(sp.get("limit") || 20) || 20, 1), 50);
    const offset = Math.max(Number(sp.get("offset") || 0) || 0, 0);

    const rows = await prisma.admissionInfo.findMany({
      where: {
        userId: null,
        ...(university ? { university: { contains: university } } : {}),
        ...(major ? { major: { contains: major } } : {}),
        ...(year ? { year } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ year: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        university: true,
        major: true,
        year: true,
        category: true,
        data: true,
        source: true,
        verifyStatus: true,
        createdAt: true,
      },
    });

    const entries = await toEntryViews(rows, user!.id);
    const aggregated = aggregateRows(entries as RawAggRow[]);

    // 按院校分组 → SchoolSummary
    const byUni = new Map<string, RawAggRow[]>();
    for (const r of entries as RawAggRow[]) {
      const list = byUni.get(r.university) || [];
      list.push(r);
      byUni.set(r.university, list);
    }

    const schools: SchoolSummary[] = [];
    for (const [uni, uniRows] of byUni) {
      const uniAgg = aggregateRows(uniRows);
      const majors = new Set(uniRows.map((r) => r.major));
      const years = new Set(uniRows.map((r) => r.year));
      const categoryCounts: Record<string, number> = {};
      for (const r of uniRows) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      const latestYear = Math.max(...Array.from(years).filter((y) => !isNaN(y)), -1) || null;
      // 最新年份、信任最高的一条 score_line 作为摘要
      const scoreEntries = uniAgg.filter((e) => e.category === "score_line" && e.year === latestYear);
      let latestScore: SchoolSummary["latestScore"] = null;
      if (scoreEntries.length > 0) {
        const best = scoreEntries.sort((a, b) => b.trust - a.trust)[0];
        const sc = best.data?.scores as Record<string, unknown> | undefined;
        if (sc) {
          const scores: Record<string, number | string> = {};
          let count = 0;
          for (const [k, v] of Object.entries(sc)) {
            if (count >= 3) break;
            const f = v as { agreed?: boolean; value?: number | string | null } | undefined;
            if (f && f.value != null) {
              scores[k] = f.value;
              count++;
            }
          }
          latestScore = { major: best.major, year: best.year, scores };
        }
      }
      schools.push({
        university: uni,
        majorCount: majors.size,
        yearCount: years.size,
        categoryCounts,
        sourceCount: uniRows.length,
        vouchCount: uniRows.reduce((s, r) => s + r.vouchCount, 0),
        disputeCount: uniRows.reduce((s, r) => s + r.disputeCount, 0),
        trust: uniRows.reduce((s, r) => s + r.vouchCount - r.disputeCount, 0),
        latestYear,
        latestScore,
      });
    }

    // 排序
    schools.sort((a, b) => {
      if (sort === "data") return b.sourceCount - a.sourceCount;
      if (sort === "trust") return b.trust - a.trust;
      return (b.latestYear ?? -1) - (a.latestYear ?? -1);
    });

    const total = schools.length;
    const page = schools.slice(offset, offset + limit);

    return jsonNoStore({ schools: page, total });
  } catch (err) {
    return handleApiError(err, "查询院校知识库");
  }
}
