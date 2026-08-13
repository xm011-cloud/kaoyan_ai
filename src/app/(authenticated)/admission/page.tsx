"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";
import { PageHeader } from "@/components/ui/page-header";
import { AdmissionCompare } from "@/components/admission-compare";
import { ImportTab } from "./_components/import-tab";

interface SearchResult {
  university: string;
  major: string;
  year: number | null;
  data: Record<string, unknown> | null;
  rawResults: { title: string; url: string; snippet: string; query: string }[];
  sources: string[];
  disclaimer: string;
  fromAIKnowledge?: boolean;
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

export default function AdmissionPage() {
  const [tab, setTab] = useState<"search" | "compare" | "saved" | "import">("search");

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
  const handleSearch = async () => {
    if (!searchUni.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);

    try {
      const res = await fetch("/api/admission/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: searchUni.trim(),
          major: searchMajor.trim(),
          year: searchYear ? parseInt(searchYear) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "搜索失败");
      } else {
        setSearchResult(data);
      }
    } catch {
      setSearchError("网络错误");
    } finally {
      setSearching(false);
    }
  };

  // ── Save ──
  const handleSave = async (entry: Record<string, unknown>) => {
    const year = entry.year as number;
    const category = entry.category as string;
    if (!year || !category || !searchResult) return;

    try {
      await fetch("/api/admission/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: searchResult.university,
          major: searchResult.major || "",
          year,
          category,
          data: entry,
          source: (entry.source as string) || searchResult.sources[0] || "",
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

  // ── Helper: render AI-extracted entries ──
  const renderEntries = (sData: Record<string, unknown>) => {
    const entries = sData.entries as Record<string, unknown>[] | undefined;
    if (!entries || entries.length === 0) {
      return (
        <p className="text-sm text-gray-500">
          AI 未能提取到结构化数据，请查看下方的原始搜索结果。
        </p>
      );
    }
    return entries.map((entry: Record<string, unknown>, i: number) => (
      <div key={i} className="border border-border/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {entry.year ? `${entry.year}年` : "年份未知"}{" "}
            {entry.category === "score_line"
              ? "📈 分数线"
              : entry.category === "enrollment"
                ? "👥 招生人数"
                : entry.category === "subjects"
                  ? "📚 考试科目"
                  : "📝 其他信息"}
          </span>
          <span className="text-xs text-gray-400">
            来源: {(entry.source as string)?.slice(0, 50) || "未知"}
          </span>
        </div>

        {(entry.category === "score_line" && entry.scores) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(entry.scores as Record<string, number>).map(
              ([k, v]) => (
                <div
                  key={k}
                  className="bg-muted/50 rounded-lg px-3 py-2 text-center"
                >
                  <div className="text-lg font-bold">{v}</div>
                  <div className="text-xs text-gray-500">{k}</div>
                </div>
              )
            )}
          </div>
        ) : null}

        {entry.notes ? (
          <p className="text-xs text-gray-500 mt-2">
            {(entry.notes as string).slice(0, 300)}
          </p>
        ) : null}

        <button
          onClick={() => handleSave(entry)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700"
        >
          💾 保存此数据
        </button>
      </div>
    ));
  };

  // ── Render ──
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-xs text-yellow-700 dark:text-yellow-400">
        ⚠️ 数据来源于公开网络搜索，仅供参考。请以
        <strong>中国研究生招生信息网（yz.chsi.com.cn）</strong>
        和各校研究生院官网公布的信息为准。所有数据标注了来源和年份。
      </div>

      <PageHeader title="🏫 院校" />

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {([
          ["search", "🔍 搜索"],
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
              onClick={handleSearch}
              disabled={searching || !searchUni.trim()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {searching ? "搜索中..." : "🔍 搜索院校信息"}
            </button>
          </div>

          {searchError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-4 rounded-lg">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="space-y-4">
              {/* AI Extracted Data */}
              {searchResult.data && (
                <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
                  <h3 className="font-semibold">
                    📊 {searchResult.university}
                    {searchResult.major ? ` - ${searchResult.major}` : ""}
                  </h3>

                  {renderEntries(searchResult.data as Record<string, unknown>)}

                </div>
              )}

              {/* Raw Results */}
              <details className="bg-card rounded-2xl border border-border/50 p-5">
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

              <p className="text-xs text-gray-400">
                {searchResult.fromAIKnowledge && (
                  <span className="text-red-600 dark:text-red-400 font-medium">⚠️ 联网搜索未获取到结果，以下数据来自 AI 模型训练知识库，可能已过时。<br/></span>
                )}
                {searchResult.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
