"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { AiWaiting } from "@/components/ai-waiting";
import { useAiTask } from "@/hooks/use-ai-task";
import { AdmissionCompare } from "@/components/admission-compare";
import { ImportTab } from "./_components/import-tab";
import { SearchResults } from "@/components/admission/search-results";
import { LibraryTab } from "@/components/admission/library-tab";
import { aggregateRows, type AggregatedEntry, type RawAggRow } from "@/lib/admission";

interface AdmissionEntry {
  id: string;
  university: string;
  major: string;
  year: number;
  category: string;
  data: Record<string, unknown>;
  source: string;
  verifyStatus: string; // unverified | verified | disputed | rejected
  vouchCount: number;
  disputeCount: number;
  myFeedback: "vouch" | "dispute" | null;
}

interface SearchResult {
  university: string;
  major: string;
  year: number | null;
  entries: AdmissionEntry[];
  aggregated?: AggregatedEntry[]; // 多来源聚合视图（搜索路由新返回）
  rawResults: { title: string; url: string; snippet: string; query: string }[];
  sources: string[];
  disclaimer: string;
  library?: boolean; // 命中社区知识库
  needAI?: boolean; // 未配 AI 且无库数据
  savedNew?: Record<string, number>; // 本次新入库分类计数
}

interface SavedRecord {
  id: string;
  university: string;
  major: string;
  year: number;
  category: string;
  data: Record<string, unknown>;
  source: string;
}

interface Analysis {
  matchRate?: number;
  gap?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  summary?: string;
}

interface CompareSchool {
  university: string;
  major: string;
  year: number;
  scores: Record<string, number>;
  enrollmentQuota?: number;
  subjects?: string[];
}

// 验证状态徽标
const STATUS_META: Record<string, { label: string; cls: string }> = {
  verified: { label: "✅ 已验证", cls: "text-success border-success/30 bg-success/10" },
  unverified: { label: "⚪ 未验证", cls: "text-muted-foreground border-border bg-muted/40" },
  disputed: { label: "⚠️ 待核实", cls: "text-warning border-warning/30 bg-warning/10" },
  rejected: { label: "✗ 存疑", cls: "text-destructive border-destructive/30 bg-destructive/10" },
};

const CATEGORY_LABEL: Record<string, string> = {
  score_line: "📈 分数线",
  enrollment: "👥 招生人数",
  subjects: "📚 考试科目",
  tuition: "💰 学费",
  notes: "📝 其他信息",
};

export default function AdmissionPage() {
  const [tab, setTab] = useState<"search" | "library" | "compare" | "saved" | "import">("search");
  const searchTask = useAiTask();

  // Search state
  const [searchUni, setSearchUni] = useState("");
  const [searchMajor, setSearchMajor] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState("");

  // Saved state
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [savedGrouped, setSavedGrouped] = useState<
    { university: string; major: string; years: Record<number, SavedRecord[]> }[]
  >([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Compare state
  const [compareSchools, setCompareSchools] = useState<CompareSchool[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  // ── Search ──
  const handleSearch = async (refresh = false) => {
    if (!searchUni.trim() || searching) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    const controller = searchTask.start();

    try {
      const res = await fetch("/api/admission/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: searchUni.trim(),
          major: searchMajor.trim(),
          year: searchYear ? parseInt(searchYear) : undefined,
          refresh,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "搜索失败");
      } else {
        setSearchResult(data);
      }
    } catch (err) {
      // 用户主动取消：安静收场
      if ((err as { name?: string })?.name !== "AbortError") {
        setSearchError("网络错误");
      }
    } finally {
      searchTask.stop();
      setSearching(false);
    }
  };

  // ── 认同 / 质疑 ──
  const [disputeEntry, setDisputeEntry] = useState<AdmissionEntry | null>(null);
  const [disputeAgg, setDisputeAgg] = useState<AggregatedEntry | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedback = async (entry: AdmissionEntry, type: "vouch" | "dispute") => {
    if (submittingFeedback) return;
    setSubmittingFeedback(true);
    try {
      const res = await fetch("/api/admission/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionInfoId: entry.id,
          type,
          reason: type === "dispute" ? disputeReason.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "操作失败");
      // 更新本地展示
      setSearchResult((prev) =>
        prev
          ? {
              ...prev,
              entries: prev.entries.map((e) =>
                e.id === entry.id
                  ? {
                      ...e,
                      vouchCount: data.counts?.vouch ?? e.vouchCount,
                      disputeCount: data.counts?.dispute ?? e.disputeCount,
                      myFeedback:
                        data.action === "removed"
                          ? null
                          : (type as "vouch" | "dispute"),
                      verifyStatus:
                        type === "dispute"
                          ? "disputed"
                          : data.action === "removed" && e.verifyStatus === "disputed"
                            ? "unverified"
                            : e.verifyStatus,
                    }
                  : e
              ),
            }
          : prev
      );
      if (type === "dispute") {
        setDisputeEntry(null);
        setDisputeReason("");
        toast.success(data.action === "removed" ? "已取消质疑" : "已提交质疑，等待核实");
      } else {
        toast.success(data.action === "removed" ? "已取消认同" : "已认同此数据");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // ── 聚合视图反馈：对组内所有来源循环投票，成功后按返回计数回写底层 entries 并重算 aggregated ──
  const postAggFeedback = async (agg: AggregatedEntry, type: "vouch" | "dispute") => {
    const results: { action: string; counts?: { vouch: number; dispute: number } }[] = [];
    for (const s of agg.sources) {
      const res = await fetch("/api/admission/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionInfoId: s.id,
          type,
          reason: type === "dispute" ? disputeReason.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "操作失败");
      results.push(data);
    }
    setSearchResult((prev) => {
      if (!prev) return prev;
      const entries = prev.entries.map((e) => {
        const idx = agg.sources.findIndex((s) => s.id === e.id);
        if (idx < 0 || !results[idx]) return e;
        const r = results[idx];
        return {
          ...e,
          vouchCount: r.counts?.vouch ?? e.vouchCount,
          disputeCount: r.counts?.dispute ?? e.disputeCount,
          myFeedback: r.action === "removed" ? null : type,
          verifyStatus:
            type === "dispute"
              ? "disputed"
              : r.action === "removed" && e.verifyStatus === "disputed"
                ? "unverified"
                : e.verifyStatus,
        } as AdmissionEntry;
      });
      return { ...prev, entries, aggregated: aggregateRows(entries as RawAggRow[]) };
    });
  };

  const handleAggFeedback = async (agg: AggregatedEntry, type: "vouch" | "dispute") => {
    if (submittingFeedback) return;
    if (type === "dispute") {
      // 复用质疑弹窗，确认后走 submitAggDispute
      setDisputeAgg(agg);
      setDisputeReason("");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await postAggFeedback(agg, "vouch");
      toast.success("已认同此数据");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const submitAggDispute = async () => {
    if (!disputeAgg || submittingFeedback) return;
    setSubmittingFeedback(true);
    try {
      await postAggFeedback(disputeAgg, "dispute");
      setDisputeAgg(null);
      setDisputeReason("");
      toast.success("已提交质疑，等待核实");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // ── Save ──
  const handleSave = async (entry: AdmissionEntry) => {
    const year = entry.year;
    const category = entry.category;
    if (!year || !category || !searchResult) return;

    try {
      await fetch("/api/admission/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: searchResult.university,
          major: entry.major || searchResult.major || "",
          year,
          category,
          data: entry.data,
          source: entry.source || searchResult.rawResults?.[0]?.url || "",
        }),
      });
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const handleAddToCompare = (record: SavedRecord) => {
    const scores = (record.data as Record<string, unknown>)?.scores as
      | Record<string, number>
      | undefined;
    const enrollmentQuota = (record.data as Record<string, unknown>)
      ?.enrollmentQuota as number | undefined;
    const subjects = (record.data as Record<string, unknown>)?.subjects as
      | string[]
      | undefined;

    if (!scores) return;

    setCompareSchools((prev) => {
      const exists = prev.find(
        (s) =>
          s.university === record.university &&
          s.major === record.major &&
          s.year === record.year
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          university: record.university,
          major: record.major,
          year: record.year,
          scores,
          enrollmentQuota,
          subjects,
        },
      ];
    });
  };

  // ── Compare ──
  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/admission/saved");
      const data = await res.json();
      setSavedRecords(data.records || []);
      setSavedGrouped(data.grouped || []);
    } catch {
      // ignore
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "saved" || tab === "compare" || tab === "import") {
      loadSaved();
    }
  }, [tab, loadSaved]);

  const handleAnalyze = async () => {
    if (compareSchools.length === 0) return;
    setAnalyzing(true);

    try {
      const res = await fetch("/api/admission/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: compareSchools[0].university,
          major: compareSchools[0].major || undefined,
        }),
      });

      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch {
      // ignore
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Helper: render library entries（社区知识库数据）──
  const renderEntries = (entries: AdmissionEntry[]) => {
    if (!entries || entries.length === 0) {
      return (
        <p className="text-sm text-gray-500">
          知识库中暂无该院校数据，点击下方「联网搜索并入库」获取。
        </p>
      );
    }
    // 按信任度排序（认同 - 质疑），存疑/待核实置后
    const sorted = [...entries].sort((a, b) => {
      const trustA = a.vouchCount - a.disputeCount;
      const trustB = b.vouchCount - b.disputeCount;
      if (a.verifyStatus === "rejected" || a.verifyStatus === "disputed") return 1;
      if (b.verifyStatus === "rejected" || b.verifyStatus === "disputed") return -1;
      return trustB - trustA;
    });
    return sorted.map((entry) => {
      const status = STATUS_META[entry.verifyStatus] || STATUS_META.unverified;
      const d = entry.data || {};
      return (
        <div key={entry.id} className="border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {entry.year ? `${entry.year}年` : "年份未知"}{" "}
                {CATEGORY_LABEL[entry.category] || "📝 其他信息"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFeedback(entry, "vouch")}
                disabled={submittingFeedback}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  entry.myFeedback === "vouch"
                    ? "bg-success/15 border-success/40 text-success"
                    : "border-border/60 text-muted-foreground hover:bg-muted"
                }`}
                title="认同此数据"
              >
                👍 {entry.vouchCount > 0 ? entry.vouchCount : ""}
              </button>
              <button
                onClick={() => {
                  setDisputeEntry(entry);
                  setDisputeReason("");
                }}
                disabled={submittingFeedback}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  entry.myFeedback === "dispute"
                    ? "bg-warning/15 border-warning/40 text-warning"
                    : "border-border/60 text-muted-foreground hover:bg-muted"
                }`}
                title="质疑此数据"
              >
                ⚠️ {entry.disputeCount > 0 ? entry.disputeCount : ""}
              </button>
            </div>
          </div>

          {entry.category === "score_line" && d.scores ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(d.scores as Record<string, number>).map(([k, v]) => (
                <div key={k} className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold">{v}</div>
                  <div className="text-xs text-gray-500">{k}</div>
                </div>
              ))}
            </div>
          ) : entry.category === "enrollment" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {d.enrollmentQuota ? (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold">{d.enrollmentQuota as number}</div>
                  <div className="text-xs text-gray-500">招生人数</div>
                </div>
              ) : null}
              {d.applicants ? (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold">{d.applicants as number}</div>
                  <div className="text-xs text-gray-500">报考人数</div>
                </div>
              ) : null}
            </div>
          ) : entry.category === "subjects" && Array.isArray(d.subjects) ? (
            <div className="flex flex-wrap gap-1.5">
              {(d.subjects as string[]).map((s, i) => (
                <span key={i} className="text-xs bg-muted/50 rounded-lg px-2 py-1">
                  {s}
                </span>
              ))}
            </div>
          ) : null}

          {d.notes ? (
            <p className="text-xs text-gray-500 mt-2">{(d.notes as string).slice(0, 300)}</p>
          ) : null}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {entry.source && entry.source.startsWith("http") ? (
              <a
                href={entry.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate max-w-[260px]"
              >
                🔗 {entry.source.slice(0, 60)}
              </a>
            ) : (
              <span className="text-xs text-gray-400">来源：{entry.source || "未知"}</span>
            )}
            <button
              onClick={() => handleSave(entry)}
              className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
            >
              💾 收藏
            </button>
          </div>
        </div>
      );
    });
  };

  // ── Render ──
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-xs text-yellow-700 dark:text-yellow-400">
        ⚠️ 数据来源于公开网络搜索，仅供参考。请以
        <strong>中国研究生招生信息网（yz.chsi.com.cn）</strong>
        和各校研究生院官网公布的信息为准。所有数据标注了来源和年份。
      </div>

      <PageHeader title="🏫 院校情报" />

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {([
          ["search", "🔍 搜索"],
          ["library", "📚 知识库"],
          ["compare", "📊 对比"],
          ["saved", "📋 收藏"],
          ["import", "📥 导入"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── SEARCH TAB ── */}
      {tab === "search" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  院校名称 *
                </label>
                <input
                  type="text"
                  value={searchUni}
                  onChange={(e) => setSearchUni(e.target.value)}
                  placeholder="例如：北京大学"
                  className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">专业</label>
                <input
                  type="text"
                  value={searchMajor}
                  onChange={(e) => setSearchMajor(e.target.value)}
                  placeholder="例如：计算机科学与技术"
                  className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">年份</label>
                <input
                  type="number"
                  value={searchYear}
                  onChange={(e) => setSearchYear(e.target.value)}
                  placeholder="例如：2025"
                  min={2000}
                  max={2030}
                  className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={searching || !searchUni.trim()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {searching ? "搜索中..." : "🔍 搜索院校信息"}
            </button>

            {/* 搜索等待安抚：分阶段文案 + 预估 + 可取消 */}
            {searching && (
              <div className="flex justify-center">
                <AiWaiting
                  phase={searchTask.phase}
                  estimate={searchTask.estimate}
                  onCancel={searchTask.cancel}
                />
              </div>
            )}
          </div>

          {searchError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-4 rounded-lg">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="space-y-4">
              {/* 社区知识库命中横幅 */}
              {searchResult.library && (
                <div className="bg-brand/5 border border-brand/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-foreground">
                    📚 来自社区知识库（{searchResult.entries.length} 条，多来源可对比）
                  </p>
                  <button
                    onClick={() => handleSearch(true)}
                    disabled={searching}
                    className="text-xs rounded-full bg-brand px-3 py-1.5 font-medium text-brand-foreground hover:bg-brand/90 transition-colors"
                  >
                    🔍 重新搜索最新
                  </button>
                </div>
              )}

              {/* 本次新入库提示 */}
              {searchResult.savedNew && Object.keys(searchResult.savedNew).length > 0 && (
                <p className="text-xs text-success font-medium">
                  ✅ 已提取并入库 {Object.values(searchResult.savedNew).reduce((a, b) => a + b, 0)} 条数据，与所有用户共享（来源已标注）
                </p>
              )}

              {/* 未配 AI 提示 */}
              {searchResult.needAI && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">🤖 知识库暂无该院校数据，且未配置 AI</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    配置 AI 后搜索可自动提取结构化数据并入库共享；也可在「导入」Tab 手动导入。
                    <a href="/settings" className="text-brand hover:underline ml-1">去配置 AI →</a>
                  </p>
                </div>
              )}

              {/* 结构化数据 */}
              <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold">
                    📊 {searchResult.university}
                    {searchResult.major ? ` - ${searchResult.major}` : ""}
                  </h3>
                  {!searchResult.library && searchResult.entries.length === 0 && (
                    <button
                      onClick={() => handleSearch(true)}
                      disabled={searching}
                      className="text-xs rounded-full bg-brand px-3 py-1.5 font-medium text-brand-foreground hover:bg-brand/90 transition-colors"
                    >
                      {searching ? "搜索中..." : "🔍 联网搜索并入库"}
                    </button>
                  )}
                </div>

                {searchResult.aggregated && searchResult.aggregated.length > 0 ? (
                  <SearchResults
                    entries={searchResult.aggregated}
                    onFeedback={handleAggFeedback}
                    onOpenRaw={() =>
                      document.getElementById("raw-results")?.scrollIntoView({ behavior: "smooth" })
                    }
                  />
                ) : (
                  renderEntries(searchResult.entries)
                )}
              </div>

              {/* Raw Results */}
              {searchResult.rawResults.length > 0 && (
                <details id="raw-results" className="bg-card rounded-2xl border border-border/50 p-5">
                  <summary className="cursor-pointer text-sm font-medium">
                    🔗 原始搜索结果 ({searchResult.rawResults.length} 条)
                  </summary>
                  <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                    {searchResult.rawResults.map((r, i) => (
                      <div
                        key={i}
                        className="border border-border/50 rounded-xl p-3"
                      >
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {r.title}
                        </a>
                        <p className="text-xs text-gray-500 mt-1">{r.snippet}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          搜索词: {r.query}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <p className="text-xs text-gray-400">
                {searchResult.disclaimer}
              </p>

              <p className="text-xs">
                <a
                  href={`/suggestions?content=${encodeURIComponent(
                    `院校数据有误：${searchResult.university}${searchResult.major ? " " + searchResult.major : ""}`
                  )}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  🙏 数据有误？反馈给作者
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── LIBRARY TAB ── */}
      {tab === "library" && <LibraryTab />}

      {/* ── COMPARE TAB ── */}
      {tab === "compare" && (
        <div className="space-y-4">
          {/* Select schools from saved */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="font-medium mb-3">从收藏中选择院校对比</h3>
            {loadingSaved ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : savedGrouped.length === 0 ? (
              <p className="text-sm text-gray-400">
                暂无收藏数据，先去搜索并保存院校信息
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {savedGrouped.map((g, i) => {
                  const latestYear = Math.max(
                    ...Object.keys(g.years).map(Number)
                  );
                  const latest = g.years[latestYear]?.find(
                    (r) => r.category === "score_line"
                  );
                  const scores = (latest?.data as Record<string, unknown>)
                    ?.scores as Record<string, number> | undefined;

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between border border-border/50 rounded-xl p-3"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {g.university}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {g.major}
                        </span>
                        {scores && (
                          <span className="text-xs text-gray-500 ml-2">
                            {Object.entries(scores)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}:${v}`)
                              .join(", ")}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!scores) return;
                          setCompareSchools((prev) => {
                            const exists = prev.find(
                              (s) =>
                                s.university === g.university &&
                                s.major === g.major &&
                                s.year === latestYear
                            );
                            if (exists) return prev;
                            return [
                              ...prev,
                              {
                                university: g.university,
                                major: g.major,
                                year: latestYear,
                                scores,
                              },
                            ];
                          });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        + 加入对比
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compare table + analysis */}
          <AdmissionCompare
            schools={compareSchools}
            analysis={analysis}
            loading={analyzing}
            onRemove={(i) =>
              setCompareSchools((prev) => prev.filter((_, idx) => idx !== i))
            }
            onAnalyze={handleAnalyze}
          />
        </div>
      )}

      {/* ── SAVED TAB ── */}
      {tab === "saved" && (
        <div className="space-y-4">
          {loadingSaved ? (
            <p className="text-sm text-gray-400 text-center py-10">加载中...</p>
          ) : savedGrouped.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>还没有收藏的院校数据</p>
              <p className="text-sm">在搜索 Tab 中搜索并保存院校信息</p>
            </div>
          ) : (
            savedGrouped.map((g, i) => {
              const years = Object.keys(g.years)
                .map(Number)
                .sort((a, b) => b - a);

              return (
                <div
                  key={i}
                  className="bg-card rounded-2xl border border-border/50 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{g.university}</h3>
                      <p className="text-sm text-gray-500">{g.major}</p>
                    </div>
                    <button
                      onClick={() => {
                        const latestYear = years[0];
                        const line = g.years[latestYear]?.find(
                          (r) => r.category === "score_line"
                        );
                        if (line) handleAddToCompare(line);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      📊 加入对比
                    </button>
                  </div>

                  <div className="space-y-2">
                    {years.map((year) => (
                      <div key={year}>
                        <h4 className="text-sm font-medium text-gray-600 mt-3 mb-1">
                          {year}年
                        </h4>
                        {g.years[year].map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between text-sm border-t border-border/50 py-2"
                          >
                            <span className="text-gray-500">
                              {r.category === "score_line"
                                ? "📈 分数线"
                                : r.category === "enrollment"
                                  ? "👥 招生人数"
                                  : r.category === "subjects"
                                    ? "📚 考试科目"
                                    : "📝 其他"}
                            </span>
                            <span className="text-xs text-gray-400 max-w-xs truncate">
                              {JSON.stringify(r.data).slice(0, 100)}
                            </span>
                            <button
                              onClick={async () => {
                                const ok = await confirmDialog({
                                  title: "删除记录",
                                  message: "确定删除此记录？",
                                  confirmLabel: "删除",
                                  danger: true,
                                });
                                if (!ok) return;
                                await fetch(
                                  `/api/admission/saved?id=${r.id}`,
                                  { method: "DELETE" }
                                );
                                loadSaved();
                              }}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === "import" && (
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <ImportTab onImportComplete={loadSaved} />
        </div>
      )}

      {/* ── 质疑弹窗：单条（旧视图）与聚合组（新视图）共用 ── */}
      {disputeEntry && (
        <Modal
          open
          onClose={() => setDisputeEntry(null)}
          title="⚠️ 质疑此数据"
          description={`${disputeEntry.university} ${disputeEntry.major} ${disputeEntry.year}年 ${CATEGORY_LABEL[disputeEntry.category] || ""}`}
          footer={
            <>
              <button
                onClick={() => setDisputeEntry(null)}
                className="rounded-full h-11 px-6 text-sm font-medium border border-border/60 hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleFeedback(disputeEntry, "dispute")}
                disabled={!disputeReason.trim() || submittingFeedback}
                className="rounded-full h-11 px-6 text-sm font-medium bg-warning text-white hover:bg-warning/90 disabled:opacity-50 transition-colors"
              >
                提交质疑
              </button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground mb-2">
            请说明你认为数据有误的原因（如分数不对、年份错误、来源不可信等），作者会核实后处理。
          </p>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="例如：2025 年复试线实际是 350 而不是 320…"
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
          />
          <p className="text-right text-xs text-muted-foreground mt-1">
            {disputeReason.length}/500
          </p>
        </Modal>
      )}

      {disputeAgg && (
        <Modal
          open
          onClose={() => setDisputeAgg(null)}
          title="⚠️ 质疑此数据"
          description={`${disputeAgg.university} ${disputeAgg.major} ${disputeAgg.year}年 ${CATEGORY_LABEL[disputeAgg.category] || ""}（将对 ${disputeAgg.sourceCount} 个来源一并提交质疑）`}
          footer={
            <>
              <button
                onClick={() => setDisputeAgg(null)}
                className="rounded-full h-11 px-6 text-sm font-medium border border-border/60 hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => submitAggDispute()}
                disabled={!disputeReason.trim() || submittingFeedback}
                className="rounded-full h-11 px-6 text-sm font-medium bg-warning text-white hover:bg-warning/90 disabled:opacity-50 transition-colors"
              >
                提交质疑
              </button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground mb-2">
            请说明你认为数据有误的原因（如分数不对、年份错误、来源不可信等），作者会核实后处理。
          </p>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="例如：2025 年复试线实际是 350 而不是 320…"
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
          />
          <p className="text-right text-xs text-muted-foreground mt-1">
            {disputeReason.length}/500
          </p>
        </Modal>
      )}
    </div>
  );
}
