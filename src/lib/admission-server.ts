/**
 * 院校情报 server-only 增强 — import prisma，供搜索/知识库/详情页复用。
 * 把原始 AdmissionInfo 行 → 带反馈计数的展示视图 + 聚合视图（aggregateRows 是纯函数，见 admission.ts）。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aggregateRows, type RawAggRow, type AggregatedEntry } from "@/lib/admission";

export interface AdmissionEntryView {
  id: string;
  university: string;
  major: string;
  year: number;
  category: string;
  data: Record<string, unknown>;
  source: string;
  verifyStatus: string;
  vouchCount: number;
  disputeCount: number;
  myFeedback: "vouch" | "dispute" | null;
}

export type AdmissionRow = {
  id: string;
  university: string;
  major: string;
  year: number;
  category: string;
  data: Prisma.JsonValue;
  source: string;
  verifyStatus: string;
  createdAt: Date;
};

/** 原始行 → 展示视图（带 vouch/dispute 计数 + 我的反馈）。逻辑迁移自 search/route.ts 原 toEntryViews。 */
export async function toEntryViews(rows: AdmissionRow[], userId: string): Promise<AdmissionEntryView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [counts, my] = await Promise.all([
    prisma.admissionFeedback.groupBy({
      by: ["admissionInfoId", "type"],
      where: { admissionInfoId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.admissionFeedback.findMany({
      where: { admissionInfoId: { in: ids }, userId },
      select: { admissionInfoId: true, type: true },
    }),
  ]);
  const myMap = new Map(my.map((m) => [m.admissionInfoId, m.type]));
  const countMap = new Map<string, { vouch: number; dispute: number }>();
  for (const c of counts) {
    const cur = countMap.get(c.admissionInfoId) || { vouch: 0, dispute: 0 };
    if (c.type === "vouch") cur.vouch = c._count._all;
    else cur.dispute = c._count._all;
    countMap.set(c.admissionInfoId, cur);
  }
  return rows.map((r) => {
    const cnt = countMap.get(r.id) || { vouch: 0, dispute: 0 };
    return {
      id: r.id,
      university: r.university,
      major: r.major,
      year: r.year,
      category: r.category,
      data: (r.data as Record<string, unknown>) || {},
      source: r.source || "",
      verifyStatus: r.verifyStatus,
      vouchCount: cnt.vouch,
      disputeCount: cnt.dispute,
      myFeedback: (myMap.get(r.id) as "vouch" | "dispute") || null,
    };
  });
}

/** 原始行 → 展示视图 + 聚合视图（搜索路由 / 详情页共用） */
export async function enrichRows(
  rows: AdmissionRow[],
  userId: string
): Promise<{ entries: AdmissionEntryView[]; aggregated: AggregatedEntry[] }> {
  const entries = await toEntryViews(rows, userId);
  return { entries, aggregated: aggregateRows(entries as RawAggRow[]) };
}

/**
 * 按院校取全局共享数据并增强（详情页用）。
 * 精确匹配；0 行时回退 contains（兜住「北京大学」vs「北京大学深圳研究生院」等异写）。
 */
export async function enrichRowsForUniversity(
  university: string,
  userId: string,
  opts?: { major?: string; year?: number; category?: string }
): Promise<{ entries: AdmissionEntryView[]; aggregated: AggregatedEntry[] }> {
  const base: Prisma.AdmissionInfoWhereInput = { userId: null };
  const buildWhere = (uniMatch: string | Prisma.StringFilter<"AdmissionInfo">): Prisma.AdmissionInfoWhereInput => ({
    ...base,
    university: uniMatch,
    ...(opts?.major ? { major: { contains: opts.major } } : {}),
    ...(opts?.year ? { year: opts.year } : {}),
    ...(opts?.category ? { category: opts.category } : {}),
  });
  const orderBy: Prisma.AdmissionInfoOrderByWithRelationInput[] = [
    { year: "desc" },
    { createdAt: "asc" },
  ];
  let rows = await prisma.admissionInfo.findMany({
    where: buildWhere(university),
    orderBy,
  });
  if (rows.length === 0) {
    rows = await prisma.admissionInfo.findMany({
      where: buildWhere({ contains: university }),
      orderBy,
    });
  }
  return enrichRows(rows, userId);
}
