"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useGoal } from "@/hooks/use-goal";

interface WrongQuestion {
  id: string;
  subject: string;
  question: string;
  answer: string;
  source: string;
  tags: string[];
  reviewed: boolean;
  reviewCount: number;
  lastReviewDate: string | null;
  easeFactor: number;
  interval: number;
  nextReviewDate: string | null;
  createdAt: string;
}

interface SimilarQuestion {
  question: string;
  answer: string;
  explanation: string;
}

export default function WrongQuestionsPage() {
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unreviewed" | "reviewed" | "due">("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: goal } = useGoal();
  const subjects = goal?.subjects ?? [];

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    subject: "",
    question: "",
    answer: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);

  // Batch import modal
  const [showBatch, setShowBatch] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchFormat, setBatchFormat] = useState<"text" | "json">("text");
  const [batchImporting, setBatchImporting] = useState(false);

  // Review mode
  const [reviewing, setReviewing] = useState<WrongQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<WrongQuestion | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [generatingSimilar, setGeneratingSimilar] = useState(false);

  const loadQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab === "unreviewed") params.set("reviewed", "false");
      if (tab === "reviewed") params.set("reviewed", "true");
      if (tab === "due") {
        params.set("reviewed", "false");
        params.set("dueToday", "true");
      }
      if (subjectFilter) params.set("subject", subjectFilter);
      if (searchTerm) params.set("search", searchTerm);
      params.set("limit", "50");

      const res = await fetch(`/api/wrong-questions?${params.toString()}`);
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tab, subjectFilter, searchTerm]);

  useEffect(() => {
    loadQuestions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // 科目加载后自动设置默认值
  useEffect(() => {
    if (subjects.length > 0 && !addForm.subject) {
      setAddForm((f) => ({ ...f, subject: subjects[0] }));
    }
  }, [subjects, addForm.subject]);

  const handleAdd = async () => {
    if (!addForm.subject || !addForm.question || !addForm.answer) return;
    setSaving(true);
    try {
      const res = await fetch("/api/wrong-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: addForm.subject,
          question: addForm.question,
          answer: addForm.answer,
          source: "manual",
          tags: addForm.tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ subject: subjects[0] || "", question: "", answer: "", tags: "" });
        loadQuestions();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    setBatchImporting(true);
    try {
      const body = batchFormat === "json" ? { questions: JSON.parse(batchText) } : { text: batchText };
      const res = await fetch("/api/wrong-questions/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setShowBatch(false);
        setBatchText("");
        alert(`✅ 成功导入 ${data.count} 道错题`);
        loadQuestions();
      } else {
        alert(data.error || "导入失败");
      }
    } catch (err) {
      alert(err instanceof SyntaxError ? "JSON 格式错误，请检查" : "导入失败");
    } finally {
      setBatchImporting(false);
    }
  };

  // SM-2: Mark reviewed with rating (0-5)
  const handleMarkReviewed = async (id: string, rating: number = 3) => {
    try {
      await fetch(`/api/wrong-questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: true, rating }),
      });
      loadQuestions();
      if (reviewing?.id === id) {
        setReviewing(null);
        setShowAnswer(false);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这道错题吗？")) return;
    try {
      await fetch(`/api/wrong-questions/${id}`, { method: "DELETE" });
      if (detail?.id === id) setDetail(null);
      if (reviewing?.id === id) setReviewing(null);
      loadQuestions();
    } catch {
      // ignore
    }
  };

  const handleGenerateSimilar = async (wq: WrongQuestion) => {
    setGeneratingSimilar(true);
    setSimilarQuestions([]);
    try {
      const res = await fetch("/api/ai/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongQuestionId: wq.id, count: 3 }),
      });
      const data = await res.json();
      setSimilarQuestions(data.questions || []);
    } catch {
      // ignore
    } finally {
      setGeneratingSimilar(false);
    }
  };

  // Export selected questions as printable PDF-like page
  const handleExportPDF = () => {
    const toExport = questions.filter((q) => {
      if (tab === "unreviewed") return !q.reviewed;
      if (tab === "reviewed") return q.reviewed;
      if (tab === "due") return !q.reviewed;
      return true;
    });

    if (toExport.length === 0) {
      alert("没有可导出的错题");
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>错题本导出</title>
  <style>
    body { font-family: "Microsoft YaHei", sans-serif; padding: 20px; color: #333; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
    .subject { display: inline-block; background: #EFF6FF; color: #1D4ED8; font-size: 12px; padding: 2px 8px; border-radius: 4px; }
    .tag { display: inline-block; background: #F3F4F6; color: #6B7280; font-size: 11px; padding: 1px 6px; border-radius: 3px; margin: 2px; }
    .question { font-weight: 600; margin: 8px 0; line-height: 1.6; }
    .answer { background: #F0FDF4; border-left: 3px solid #22C55E; padding: 12px; line-height: 1.6; white-space: pre-wrap; }
    .meta { font-size: 11px; color: #9CA3AF; margin-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>📝 错题本导出 — ${new Date().toLocaleDateString("zh-CN")}</h1>
  <p style="color:#666;">共 ${toExport.length} 道错题</p>
  ${toExport
    .map(
      (q) => `
  <div class="card">
    <div>
      <span class="subject">${q.subject}</span>
      ${q.tags.map((t) => `<span class="tag">${t}</span>`).join("")}
    </div>
    <div class="question">${q.question}</div>
    <div class="answer"><strong>答案/解析：</strong>\n${q.answer}</div>
    <div class="meta">来源: ${sourceLabel(q.source)} · 复习次数: ${q.reviewCount} · 添加于: ${new Date(q.createdAt).toLocaleDateString("zh-CN")}</div>
  </div>`
    )
    .join("\n")}
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const sourceLabel = (s: string) =>
    s === "chat" ? "💬 AI问答" : s === "practice" ? "✏️ 练习" : "✍️ 手动";

  const unreviewedCount = questions.filter((q) => !q.reviewed).length;
  const dueTodayCount = questions.filter((q) => {
    if (q.reviewed || !q.nextReviewDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const review = new Date(q.nextReviewDate);
    review.setHours(0, 0, 0, 0);
    return review <= today;
  }).length;

  // Rating labels for SM-2
  const ratingLabels = [
    { value: 0, label: "完全忘了", color: "bg-red-500 hover:bg-red-600" },
    { value: 1, label: "很模糊", color: "bg-orange-500 hover:bg-orange-600" },
    { value: 2, label: "有点难", color: "bg-yellow-500 hover:bg-yellow-600" },
    { value: 3, label: "还可以", color: "bg-lime-500 hover:bg-lime-600" },
    { value: 4, label: "基本会", color: "bg-emerald-500 hover:bg-emerald-600" },
    { value: 5, label: "很熟练", color: "bg-green-500 hover:bg-green-600" },
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">错题本</h1>
            <p className="text-gray-500 mt-1">
              {questions.length > 0
                ? `共 ${questions.length} 道错题，${unreviewedCount} 道待复习${
                    dueTodayCount > 0 ? `，${dueTodayCount} 道今日到期` : ""
                  }`
                : "收集错题，定期复习，巩固薄弱知识点"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBatch(true)}>
              📥 批量导入
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              🖨️ 导出
            </Button>
            <Button onClick={() => setShowAdd(true)}>添加错题</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {[
              ["all", "全部"],
              ["due", "今日到期"],
              ["unreviewed", "未复习"],
              ["reviewed", "已复习"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k as typeof tab)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === k
                    ? "bg-white dark:bg-gray-700 shadow-sm font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {k === "due" && dueTodayCount > 0 && (
                  <span className="ml-1 text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                    {dueTodayCount}
                  </span>
                )}
                {k === "unreviewed" && unreviewedCount > 0 && (
                  <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                    {unreviewedCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">全部科目</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="搜索错题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700 flex-1 min-w-[120px]"
          />
        </div>

        {/* Question list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">🔴</div>
            <p className="font-medium">还没有错题</p>
            <p className="text-sm mt-1">
              去 AI 问答提问后把没掌握的加入错题本，或点击"添加错题"手动添加
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => {
              const isDue =
                !q.reviewed &&
                q.nextReviewDate &&
                (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const review = new Date(q.nextReviewDate);
                  review.setHours(0, 0, 0, 0);
                  return review <= today;
                })();

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow ${
                    isDue
                      ? "border-l-4 border-l-orange-400"
                      : !q.reviewed
                      ? "border-l-4 border-l-red-400"
                      : "border-l-4 border-l-green-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setDetail(q)}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">
                          {q.subject}
                        </span>
                        <span className="text-xs text-gray-400">{sourceLabel(q.source)}</span>
                        {isDue ? (
                          <span className="text-xs bg-orange-50 text-orange-500 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                            🔔 今日复习
                          </span>
                        ) : !q.reviewed ? (
                          <span className="text-xs bg-red-50 text-red-500 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                            待复习
                          </span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-500 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                            已复习 ×{q.reviewCount}
                          </span>
                        )}
                        {q.nextReviewDate && !q.reviewed && (
                          <span className="text-xs text-gray-400">
                            下次复习：{new Date(q.nextReviewDate).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                        {q.interval > 0 && (
                          <span className="text-xs text-gray-400">
                            间隔 {q.interval} 天 · EF {q.easeFactor.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed line-clamp-2">{q.question}</p>
                      {q.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.tags.map((t, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewing(q);
                          setShowAnswer(false);
                        }}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1"
                        title="复习"
                      >
                        📖
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-lg">添加错题</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">科目</label>
                <select
                  value={addForm.subject}
                  onChange={(e) => setAddForm({ ...addForm, subject: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="">选择科目</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">题目</label>
                <textarea
                  value={addForm.question}
                  onChange={(e) => setAddForm({ ...addForm, question: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y"
                  placeholder="输入题目内容..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">答案/解析</label>
                <textarea
                  value={addForm.answer}
                  onChange={(e) => setAddForm({ ...addForm, answer: e.target.value })}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y"
                  placeholder="输入正确答案和解析..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
                <input
                  value={addForm.tags}
                  onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  placeholder="如：极限, 连续性, 导数"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                取消
              </Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Import Modal ── */}
      {showBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowBatch(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg">批量导入错题</h3>
              <button
                onClick={() => setShowBatch(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setBatchFormat("text")}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    batchFormat === "text"
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  文本格式
                </button>
                <button
                  onClick={() => setBatchFormat("json")}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    batchFormat === "json"
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  JSON 格式
                </button>
              </div>

              {batchFormat === "text" ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    用 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">---</code>{" "}
                    分隔每道题，每段格式：
                  </p>
                  <pre className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded p-2 mb-2 whitespace-pre-wrap">
{`科目：高等数学
题目：求极限 lim(x→0) (sin x)/x
答案：1，使用重要极限公式
标签：极限, 重要公式
---
科目：英语
题目：The professor required that we ___ the report by Friday.
答案：hand in
标签：虚拟语气, 语法`}
                  </pre>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    rows={10}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y font-mono"
                    placeholder="在此粘贴错题..."
                  />
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-2">粘贴 JSON 数组：</p>
                  <pre className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded p-2 mb-2">
{`[{"subject":"高等数学","question":"求极限...","answer":"1","tags":["极限"]}]`}
                  </pre>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    rows={8}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y font-mono"
                    placeholder='[{"subject":"...", "question":"...", "answer":"...", "tags":[...]}]'
                  />
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={() => setShowBatch(false)}>
                取消
              </Button>
              <Button onClick={handleBatchImport} disabled={batchImporting || !batchText.trim()}>
                {batchImporting ? "导入中..." : "导入"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Mode (with SM-2 rating) ── */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReviewing(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
              <span className="text-sm text-gray-500">
                📖 复习模式 · {reviewing.subject}
                {reviewing.interval > 0 && ` · 间隔${reviewing.interval}天`}
              </span>
              <button
                onClick={() => setReviewing(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">题目</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed">
                  {reviewing.question}
                </div>
              </div>

              {!showAnswer ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAnswer(true)}
                >
                  👆 点击查看答案
                </Button>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">答案/解析</h4>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-sm leading-relaxed border border-green-200 dark:border-green-800">
                    {reviewing.answer}
                  </div>
                </div>
              )}

              {reviewing.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {reviewing.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* SM-2 Rating bar */}
            {showAnswer && (
              <div className="px-5 py-3 border-t dark:border-gray-700 shrink-0">
                <p className="text-xs text-gray-500 mb-2 text-center">你对这道题的掌握程度？</p>
                <div className="flex gap-1.5">
                  {ratingLabels.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => handleMarkReviewed(reviewing.id, r.value)}
                      className={`flex-1 text-white text-xs font-medium py-2 rounded-lg transition-colors ${r.color}`}
                      title={`评分 ${r.value}/5`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2 justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const idx = questions.findIndex((q) => q.id === reviewing.id);
                      const remaining = questions.filter((q, i) => i > idx && !q.reviewed);
                      if (remaining.length > 0) {
                        setReviewing(remaining[0]);
                        setShowAnswer(false);
                      } else {
                        setReviewing(null);
                      }
                    }}
                  >
                    再看看
                  </Button>
                  <span className="text-xs text-gray-400 self-center">
                    0=完全忘了 · 3=还可以 · 5=很熟练
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setDetail(null);
            setSimilarQuestions([]);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg">错题详情</h3>
                <p className="text-xs text-gray-500">
                  {detail.subject} · {sourceLabel(detail.source)} ·{" "}
                  {new Date(detail.createdAt).toLocaleDateString("zh-CN")}
                  {detail.interval > 0 && ` · 间隔${detail.interval}天 · EF${detail.easeFactor.toFixed(1)}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setDetail(null);
                  setSimilarQuestions([]);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">题目</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed">
                  {detail.question}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">答案/解析</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm leading-relaxed">
                  {detail.answer}
                </div>
              </div>
              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* AI Similar Questions */}
              <div className="border-t dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">AI 出类似题</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateSimilar(detail)}
                    disabled={generatingSimilar}
                  >
                    {generatingSimilar
                      ? "生成中..."
                      : similarQuestions.length > 0
                      ? "重新生成"
                      : "生成练习题"}
                  </Button>
                </div>
                {similarQuestions.length > 0 && (
                  <div className="space-y-3">
                    {similarQuestions.map((sq, i) => (
                      <details
                        key={i}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm"
                      >
                        <summary className="cursor-pointer font-medium">
                          {i + 1}. {sq.question.slice(0, 60)}...
                        </summary>
                        <div className="mt-2 space-y-2 pt-2 border-t dark:border-gray-700">
                          <p>
                            <strong>答案：</strong>
                            {sq.answer}
                          </p>
                          <p>
                            <strong>解析：</strong>
                            {sq.explanation}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(detail.id)}
                className="text-red-500 hover:text-red-700"
              >
                删除
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDetail(null);
                  setSimilarQuestions([]);
                }}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
