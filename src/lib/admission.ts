/**
 * 院校情报聚合 — 纯函数库（不 import prisma，客户端可复用做乐观重算）。
 *
 * 把多条来源记录（AdmissionInfo 行）按 (university, major, year, category) 聚合成一条展示视图，
 * 供搜索响应 / 知识库列表 / 院校详情页共用。多来源保留溯源（sources + variants），非破坏性。
 *
 * 聚合规则：
 * - 分组键：university/major/year/category 精确匹配（中文不归一化，异写靠详情页 contains 兜底）
 * - 字段冲突：mergeScalar 先数值归一比较，失败回退字符串比较；一致→共识值，冲突→variants 并排
 * - verifyStatus 合并：取最差 rejected > disputed > unverified > verified，同时透出 statusCounts 与各来源自身状态
 * - trust = Σvouch − Σdispute；myFeedback 聚合键 dispute 优先
 */

export type AdmissionCategory = "score_line" | "enrollment" | "subjects" | "tuition" | "notes";
export type VerifyStatus = "unverified" | "verified" | "disputed" | "rejected";

/** 聚合输入行（即带反馈计数的展示视图形状，来自搜索/详情页的 toEntryViews 输出） */
export interface RawAggRow {
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
  createdAt?: string;
}

/** 单字段合并结果（值格 / 表格单元格都用它） */
export interface MergedField<T> {
  /** 该字段所有来源一致（归一化后） */
  agreed: boolean;
  /** 一致时 = 共识值；冲突时 null（用 variants 并排） */
  value: T | null;
  /** 每来源一条（始终含全部有值来源） */
  variants: { value: T; sourceId: string; source: string; verifyStatus: string }[];
}

/** 聚合卡内可展开的来源摘要 */
export interface AggSource {
  id: string;
  source: string;
  verifyStatus: string;
  vouchCount: number;
  disputeCount: number;
  myFeedback: "vouch" | "dispute" | null;
}

export interface AggregatedEntry {
  key: string; // `${university}::${major}::${year}::${category}`
  university: string;
  major: string;
  year: number;
  category: AdmissionCategory;
  sourceCount: number;
  /** 组内取最差（rejected>disputed>unverified>verified） */
  mergedStatus: VerifyStatus;
  statusCounts: Record<string, number>;
  vouchCount: number;
  disputeCount: number;
  trust: number;
  myFeedback: "vouch" | "dispute" | null;
  sources: AggSource[];
  /** 分类形状的合并结果（见各 category 分支） */
  data: Record<string, unknown>;
}

export const VERIFY_RANK: Record<VerifyStatus, number> = {
  rejected: 0,
  disputed: 1,
  unverified: 2,
  verified: 3,
};

// ── 工具 ──

function normalize(v: unknown): { n: number | null; raw: string } {
  if (v == null) return { n: null, raw: "" };
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return { n: Number.isFinite(n) ? n : null, raw: String(v).trim() };
}

function sameValue(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.n != null && nb.n != null) return na.n === nb.n;
  return na.raw === nb.raw;
}

/** 单字段合并：取有值的来源，全等则共识，否则 variants 并排 */
function mergeScalar<T>(
  rows: RawAggRow[],
  pick: (r: RawAggRow) => unknown
): MergedField<T> {
  const withVal = rows.filter((r) => {
    const v = pick(r);
    return v != null && String(v).trim() !== "";
  });
  if (withVal.length === 0) return { agreed: true, value: null, variants: [] };
  const first = pick(withVal[0]);
  const agreed = withVal.every((r) => sameValue(pick(r), first));
  return {
    agreed,
    value: agreed ? (first as T) : null,
    variants: withVal.map((r) => ({
      value: pick(r) as T,
      sourceId: r.id,
      source: r.source,
      verifyStatus: r.verifyStatus,
    })),
  };
}

function collectNotes(rows: RawAggRow[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const r of rows) {
    const n = (r.data?.notes as string | undefined)?.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    notes.push(n.length > 200 ? `${n.slice(0, 200)}…` : n);
  }
  return notes;
}

/** 有值来源的行（聚合分组用，保留输入顺序） */
function sourceSummaries(rows: RawAggRow[]): AggSource[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source || "",
    verifyStatus: r.verifyStatus,
    vouchCount: r.vouchCount,
    disputeCount: r.disputeCount,
    myFeedback: r.myFeedback,
  }));
}

// ── 聚合主入口 ──

export function aggregateRows(rows: RawAggRow[]): AggregatedEntry[] {
  const groups = new Map<string, RawAggRow[]>();
  for (const r of rows) {
    const key = `${r.university}::${r.major}::${r.year}::${r.category}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const out: AggregatedEntry[] = [];
  for (const group of groups.values()) {
    const r0 = group[0];
    const sources = sourceSummaries(group);
    const statusCounts: Record<string, number> = {};
    let minRank = Number.POSITIVE_INFINITY;
    for (const s of sources) {
      const st = (s.verifyStatus as VerifyStatus) || "unverified";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      minRank = Math.min(minRank, VERIFY_RANK[st] ?? VERIFY_RANK.unverified);
    }
    const mergedStatus = (Object.keys(VERIFY_RANK) as VerifyStatus[]).find(
      (k) => VERIFY_RANK[k] === minRank
    ) ?? "unverified";
    const vouchCount = group.reduce((s, r) => s + r.vouchCount, 0);
    const disputeCount = group.reduce((s, r) => s + r.disputeCount, 0);
    const myFeedback = sources.some((s) => s.myFeedback === "dispute")
      ? "dispute"
      : sources.some((s) => s.myFeedback === "vouch")
        ? "vouch"
        : null;

    out.push({
      key: `${r0.university}::${r0.major}::${r0.year}::${r0.category}`,
      university: r0.university,
      major: r0.major,
      year: r0.year,
      category: r0.category as AdmissionCategory,
      sourceCount: group.length,
      mergedStatus,
      statusCounts,
      vouchCount,
      disputeCount,
      trust: vouchCount - disputeCount,
      myFeedback,
      sources,
      data: mergeByCategory(group, r0.category),
    });
  }
  return out;
}

function mergeByCategory(group: RawAggRow[], category: string): Record<string, unknown> {
  const notes = collectNotes(group);
  if (category === "score_line") {
    const keys = new Set<string>();
    for (const r of group) {
      const scores = r.data?.scores as Record<string, unknown> | undefined;
      if (scores) for (const k of Object.keys(scores)) keys.add(k);
    }
    const scores: Record<string, MergedField<number | string>> = {};
    for (const k of keys) {
      scores[k] = mergeScalar<number | string>(group, (r) => {
        const s = (r.data?.scores as Record<string, unknown> | undefined)?.[k];
        return s;
      });
    }
    return { scores, notes };
  }
  if (category === "enrollment") {
    return {
      fields: {
        enrollmentQuota: mergeScalar<number>(group, (r) => r.data?.enrollmentQuota),
        applicants: mergeScalar<number>(group, (r) => r.data?.applicants),
      },
      notes,
    };
  }
  if (category === "subjects") {
    const map = new Map<string, string[]>();
    for (const r of group) {
      const subs = r.data?.subjects as unknown[] | undefined;
      if (Array.isArray(subs)) {
        for (const s of subs) {
          const name = String(s).trim();
          if (!name) continue;
          const ids = map.get(name) || [];
          ids.push(r.id);
          map.set(name, ids);
        }
      }
    }
    const subjects = Array.from(map.entries()).map(([name, sourceIds]) => ({
      name,
      sourceCount: sourceIds.length,
      sourceIds,
    }));
    return { subjects, notes };
  }
  if (category === "tuition") {
    return {
      tuition: mergeScalar<number | string>(group, (r) => r.data?.tuition),
      notes,
    };
  }
  // notes / 其他
  return { notes };
}

// ── 分数线对比表推导 ──
export interface ScoreTableData {
  /** 年份降序 */
  years: number[];
  /** 科目并集（保持首现顺序） */
  subjects: string[];
  cells: Record<number, Record<string, MergedField<number | string>>>;
  /** 该年合并状态（置灰依据） */
  yearStatus: Record<number, VerifyStatus>;
  yearTrust: Record<number, number>;
}

export function toScoreTable(entries: AggregatedEntry[]): ScoreTableData {
  const scoreEntries = entries.filter((e) => e.category === "score_line");
  const years = Array.from(new Set(scoreEntries.map((e) => e.year))).sort((a, b) => b - a);
  const subjects: string[] = [];
  for (const e of scoreEntries) {
    const sc = e.data?.scores as Record<string, MergedField<number | string>> | undefined;
    if (sc) for (const k of Object.keys(sc)) if (!subjects.includes(k)) subjects.push(k);
  }
  const cells: ScoreTableData["cells"] = {};
  const yearStatus: ScoreTableData["yearStatus"] = {};
  const yearTrust: ScoreTableData["yearTrust"] = {};
  for (const e of scoreEntries) {
    const sc = e.data?.scores as Record<string, MergedField<number | string>> | undefined;
    if (!sc) continue;
    cells[e.year] = cells[e.year] || {};
    for (const k of subjects) {
      const f = sc[k];
      if (f) cells[e.year][k] = f;
    }
    yearStatus[e.year] = e.mergedStatus;
    yearTrust[e.year] = e.trust;
  }
  return { years, subjects, cells, yearStatus, yearTrust };
}

// ── 管理端数据补全：粘贴文本 → 结构化行 ──

export interface SeedRowInput {
  university: string;
  major: string;
  year: number;
  category: AdmissionCategory;
  data: Record<string, unknown>;
  source: string;
}

/**
 * 解析粘贴的多行数据（管理端批量导入）。
 * 每行字段用 <Tab>（或 | 或 ，）分隔：院校 / 专业 / 年份 / 分类 / 来源 / 数据
 * 数据为「键:值」空格分隔：
 * - score_line：总分:350 政治:60 … → { scores }
 * - enrollment：招生人数:50 报考人数:300 → { enrollmentQuota, applicants }
 * - subjects：科目:政治 科目:英语一 … → { subjects }
 * - tuition：学费:15000 → { tuition }
 * 分类可省略（按数据键自动推断）；来源可省略（默认 admin-import）。
 */
export function parseAdmissionSeedText(text: string): SeedRowInput[] {
  const rows: SeedRowInput[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    // 字段分隔：优先 Tab，其次 | ，其次全角逗号
    let fields: string[];
    if (line.includes("\t")) fields = line.split("\t");
    else if (line.includes("|")) fields = line.split("|");
    else fields = line.split(/[,，]/);
    fields = fields.map((f) => f.trim());
    const [university, major, yearStr, categoryStr, source, ...dataParts] = fields;
    if (!university || !major || !yearStr) continue;

    const year = Number(yearStr);
    if (!Number.isFinite(year)) continue;

    // 解析 键:值 数据对
    const pairs: Record<string, string> = {};
    const subjects: string[] = [];
    for (const dp of (dataParts.join(" ") || "").split(/\s+/)) {
      if (!dp) continue;
      const m = dp.match(/^(.+?)[:：](.+)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim();
      if (k === "科目") subjects.push(v);
      else pairs[k] = v;
    }

    let category = (categoryStr || "").toLowerCase() as AdmissionCategory;
    const data: Record<string, unknown> = {};

    if (!category || !(["score_line", "enrollment", "subjects", "tuition", "notes"] as string[]).includes(category)) {
      // 按数据键推断分类
      if (subjects.length > 0) category = "subjects";
      else if (pairs["总分"] !== undefined) category = "score_line";
      else if (pairs["招生人数"] !== undefined || pairs["报考人数"] !== undefined) category = "enrollment";
      else if (pairs["学费"] !== undefined) category = "tuition";
      else category = "notes";
    }

    if (category === "score_line") {
      const scores: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(pairs)) {
        const n = Number(v);
        scores[k] = Number.isFinite(n) ? n : v;
      }
      data.scores = scores;
    } else if (category === "enrollment") {
      if (pairs["招生人数"] !== undefined) data.enrollmentQuota = Number(pairs["招生人数"]) || pairs["招生人数"];
      if (pairs["报考人数"] !== undefined) data.applicants = Number(pairs["报考人数"]) || pairs["报考人数"];
    } else if (category === "subjects") {
      data.subjects = subjects;
    } else if (category === "tuition") {
      data.tuition = Number(pairs["学费"]) || pairs["学费"] || pairs["学费"];
    } else {
      data.notes = Object.entries(pairs).map(([k, v]) => `${k}:${v}`).join("；") || "admin 导入";
    }

    rows.push({
      university,
      major,
      year,
      category,
      data,
      source: source || "admin-import",
    });
  }
  return rows;
}
