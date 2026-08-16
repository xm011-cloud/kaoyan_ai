"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "@/stores/toast-store";

interface ImportEntry {
  university: string;
  major: string;
  year: number;
  category: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  source?: string;
}

interface ImportResult {
  saved: number;
  entries?: ImportEntry[];
  rawText?: string;
  error?: string;
  message?: string;
  autoSaved?: boolean;
}

interface ImportTabProps {
  onImportComplete: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  score_line: "📈 分数线",
  enrollment: "👥 招生人数",
  subjects: "📚 考试科目",
  tuition: "💰 学费",
  notes: "📝 其他",
};

const JSON_TEMPLATE = `[
  {
    "university": "清华大学",
    "major": "计算机科学与技术",
    "year": 2025,
    "category": "score_line",
    "data": {
      "scores": { "总分": 350, "政治": 60, "英语": 60, "数学": 90, "专业课": 140 },
      "notes": "复试分数线"
    },
    "source": "手动录入"
  },
  {
    "university": "清华大学",
    "major": "计算机科学与技术",
    "year": 2025,
    "category": "enrollment",
    "data": { "enrollmentQuota": 50, "applicants": 300 },
    "source": "手动录入"
  }
]`;

export function ImportTab({ onImportComplete }: ImportTabProps) {
  const [mode, setMode] = useState<"file" | "text" | "json">("file");
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [universityHint, setUniversityHint] = useState("");
  const [majorHint, setMajorHint] = useState("");
  const [yearHint, setYearHint] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
      setResult(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError("");
      setResult(null);
    }
  }, []);

  const handleFileImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (universityHint.trim()) formData.append("university", universityHint.trim());
      if (majorHint.trim()) formData.append("major", majorHint.trim());
      if (yearHint) formData.append("year", yearHint);

      const res = await fetch("/api/admission/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "导入失败");
      } else {
        setResult(data);
        if (data.error) setError(data.error);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setImporting(false);
    }
  };

  const handleTextImport = async (autoSave: boolean) => {
    if (!textInput.trim()) return;
    setImporting(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admission/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textInput,
          university: universityHint.trim() || undefined,
          major: majorHint.trim() || undefined,
          year: yearHint ? parseInt(yearHint) : undefined,
          autoSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "导入失败");
      } else {
        setResult(data);
        if (data.error) setError(data.error);
        if (autoSave && data.saved > 0) {
          onImportComplete();
        }
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setImporting(false);
    }
  };

  const handleJsonImport = async () => {
    if (!jsonInput.trim()) return;
    setImporting(true);
    setError("");
    setResult(null);

    let entries: ImportEntry[];
    try {
      entries = JSON.parse(jsonInput);
      if (!Array.isArray(entries)) {
        throw new Error("必须是 JSON 数组");
      }
    } catch {
      setError("JSON 格式错误，请检查后重试");
      setImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/admission/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "导入失败");
      } else {
        setResult(data);
        onImportComplete();
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setImporting(false);
    }
  };

  const handleSaveEntry = async (entry: ImportEntry) => {
    try {
      await fetch("/api/admission/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      onImportComplete();
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const handleSaveAll = async () => {
    if (!result?.entries || result.entries.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admission/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: result.entries }),
      });
      const data = await res.json();
      if (data.saved > 0) {
        onImportComplete();
        toast.success(`已保存 ${data.saved} 条记录`);
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setImporting(false);
    }
  };

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Mode switch */}
      <div className="flex bg-muted rounded-xl p-1">
        {[
          ["file", "📁 文件上传"],
          ["text", "📝 粘贴文本"],
          ["json", "📋 粘贴 JSON"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key as typeof mode);
              setError("");
              setResult(null);
            }}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              mode === key
                ? "bg-card shadow-sm font-medium"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Hint fields (shared) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            院校名称（可选提示）
          </label>
          <input
            type="text"
            value={universityHint}
            onChange={(e) => setUniversityHint(e.target.value)}
            placeholder="例如：北京大学"
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            专业（可选提示）
          </label>
          <input
            type="text"
            value={majorHint}
            onChange={(e) => setMajorHint(e.target.value)}
            placeholder="例如：计算机科学与技术"
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            年份（可选提示）
          </label>
          <input
            type="number"
            value={yearHint}
            onChange={(e) => setYearHint(e.target.value)}
            placeholder="例如：2025"
            min={2000}
            max={2100}
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {/* ── File Upload Mode ── */}
      {mode === "file" && (
        <div className="space-y-4">
          {/* label 原生激活 hidden input（而非程序化 .click()）—— iOS PWA standalone 屏蔽 display:none 文件框的程序化 click */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "border-border/50 hover:border-brand/40"
            }`}
          >
            {/* 文件框铺满整个拖放区：点击落点在 input 本体（原生手势打开选择器），iOS PWA standalone 最稳 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.csv"
              onChange={handleFileChange}
              aria-label="选择真题文件"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {file ? (
              <div className="space-y-1">
                <div className="text-2xl">📄</div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <p className="text-xs text-gray-400">
                  点击更换文件
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-3xl">📤</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  拖拽文件到此处，或点击选择
                </p>
                <p className="text-xs text-gray-400">
                  支持 TXT / PDF 文件，最大 20MB
                </p>
              </div>
            )}
          </label>

          <button
            onClick={handleFileImport}
            disabled={!file || importing}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {importing ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-spin">⏳</span> AI 提取中...
              </span>
            ) : (
              "🔍 提取数据"
            )}
          </button>
        </div>
      )}

      {/* ── Text Paste Mode ── */}
      {mode === "text" && (
        <div className="space-y-3">
          <textarea
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              setResult(null);
              setError("");
            }}
            placeholder={`在此粘贴从网站或文件中复制的录取数据文本...\n\n例如：\n清华大学 2024年 计算机科学与技术 复试分数线\n总分: 350分\n政治: 60分\n英语: 60分\n数学一: 90分\n专业课: 140分\n\n北京大学 2024年 软件工程 招生人数: 80人`}
            rows={12}
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 font-mono resize-y"
          />

          <div className="flex gap-3">
            <button
              onClick={() => handleTextImport(false)}
              disabled={!textInput.trim() || importing}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {importing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">⏳</span> AI 提取中...
                </span>
              ) : (
                "🔍 提取并预览"
              )}
            </button>
            <button
              onClick={() => handleTextImport(true)}
              disabled={!textInput.trim() || importing}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {importing ? "处理中..." : "🔍 提取并直接保存"}
            </button>
          </div>
        </div>
      )}

      {/* ── JSON Paste Mode ── */}
      {mode === "json" && (
        <div className="space-y-3">
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">📋 查看 JSON 格式模板</summary>
            <pre className="mt-2 p-3 bg-muted/50 rounded-lg border border-border/50 text-[11px] overflow-x-auto whitespace-pre">
              {JSON_TEMPLATE}
            </pre>
          </details>

          <textarea
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setResult(null);
              setError("");
            }}
            placeholder={JSON_TEMPLATE}
            rows={12}
            className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 font-mono resize-y"
          />

          <button
            onClick={handleJsonImport}
            disabled={!jsonInput.trim() || importing}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {importing ? "导入中..." : "📋 直接导入"}
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-4 rounded-lg whitespace-pre-wrap">
          {error}
          {error.includes("AI 配置") && (
            <div className="mt-2">
              <a href="/settings" className="text-blue-600 hover:underline font-medium">
                ⚙️ 前往设置页面配置 AI →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {result.saved > 0
                ? `✅ 已保存 ${result.saved} 条记录`
                : result.entries && result.entries.length > 0
                  ? `📊 已提取 ${result.entries.length} 条记录`
                  : "暂无结果"}
            </h3>
            {result.entries && result.entries.length > 0 && result.saved === 0 && !result.autoSaved && (
              <button
                onClick={handleSaveAll}
                disabled={importing}
                className="text-sm px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                💾 保存全部
              </button>
            )}
          </div>

          {result.message && (
            <p className="text-sm text-gray-500">{result.message}</p>
          )}

          {/* Entry cards */}
          {result.entries?.map((entry, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-medium">
                    {entry.university}
                    {entry.major ? ` - ${entry.major}` : ""}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {entry.year}年 · {CATEGORY_LABELS[entry.category] || entry.category}
                  </span>
                </div>
                <span className="text-xs text-gray-400 max-w-[120px] truncate">
                  {entry.source || ""}
                </span>
              </div>

              {/* Score grid */}
              {entry.category === "score_line" &&
                entry.data.scores &&
                typeof entry.data.scores === "object" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-2">
                    {Object.entries(
                      entry.data.scores as Record<string, number>
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        className="bg-muted/50 rounded-lg px-3 py-2 text-center"
                      >
                        <div className="text-lg font-bold">
                          {typeof v === "number" ? v : String(v)}
                        </div>
                        <div className="text-xs text-gray-500">{k}</div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Enrollment info */}
              {entry.category === "enrollment" && (
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5 mb-2">
                  {typeof entry.data.enrollmentQuota === "number" && (
                    <p>招生名额：{entry.data.enrollmentQuota} 人</p>
                  )}
                  {typeof entry.data.applicants === "number" && (
                    <p>报考人数：{entry.data.applicants} 人</p>
                  )}
                  {typeof entry.data.enrollmentQuota === "number" &&
                    typeof entry.data.applicants === "number" && (
                      <p>
                        报录比：1:
                        {(
                          entry.data.applicants / entry.data.enrollmentQuota
                        ).toFixed(1)}
                      </p>
                    )}
                </div>
              )}

              {/* Subjects */}
              {entry.category === "subjects" &&
                Array.isArray(entry.data.subjects) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(entry.data.subjects as string[]).map((s, j) => (
                      <span
                        key={j}
                        className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

              {/* Notes */}
              {entry.data.notes && typeof entry.data.notes === "string" && (
                <p className="text-xs text-gray-500 mb-2">
                  {entry.data.notes.slice(0, 300)}
                </p>
              )}

              {/* Save button (if not already saved) */}
              {result.saved === 0 && !result.autoSaved && (
                <button
                  onClick={() => handleSaveEntry(entry)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  💾 保存此记录
                </button>
              )}
            </div>
          ))}

          {/* Raw text preview (only if AI extraction failed with partial data) */}
          {result.rawText && (result.entries?.length ?? 0) === 0 && (
            <details className="bg-card rounded-2xl border border-border/50 p-4">
              <summary className="cursor-pointer text-sm text-gray-500">
                📄 查看提取的原始文本
              </summary>
              <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {result.rawText}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
