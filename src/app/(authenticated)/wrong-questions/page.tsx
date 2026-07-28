"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useGoal } from "@/hooks/use-goal";
import {
  useWrongQuestions,
  useUpdateWrongQuestion,
  useDeleteWrongQuestion,
} from "@/hooks/use-wrong-questions";
import { AddModal } from "./_components/add-modal";
import { BatchImportModal } from "./_components/batch-import-modal";
import { ReviewModal } from "./_components/review-modal";
import { DetailModal } from "./_components/detail-modal";

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

const SOURCE_LABELS: Record<string, string> = {
  chat: "💬 AI问答", practice: "✏️ 练习", manual: "✍️ 手动",
};

function sourceLabel(s: string) { return SOURCE_LABELS[s] || s; }

export default function WrongQuestionsPage() {
  const [tab, setTab] = useState<"all" | "unreviewed" | "reviewed" | "due">("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: goal } = useGoal();
  const subjects = goal?.subjects ?? [];

  // Modal toggles
  const [showAdd, setShowAdd] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [reviewing, setReviewing] = useState<WrongQuestion | null>(null);
  const [detail, setDetail] = useState<WrongQuestion | null>(null);

  // ── React Query data fetching ──
  const params = useMemo(() => ({
    subject: subjectFilter || undefined,
    reviewed: tab === "unreviewed" ? "false" : tab === "reviewed" ? "true" : undefined,
    search: searchTerm || undefined,
    ...(tab === "due" ? { reviewed: "false" as const, dueToday: true as const } : {}),
    limit: 50,
  }), [tab, subjectFilter, searchTerm]);

  const { data, isLoading } = useWrongQuestions(params);
  const questions = (data?.questions as WrongQuestion[]) ?? [];

  const updateMut = useUpdateWrongQuestion();
  const deleteMut = useDeleteWrongQuestion();

  // ── Handlers ──
  const handleReviewed = (id: string, rating: number) => {
    if (rating < 0) {
      setReviewing(null);
      return;
    }
    updateMut.mutate(
      { id, reviewed: true, rating },
      { onSuccess: () => setReviewing(null) }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("确定删除这道错题吗？")) return;
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (detail?.id === id) setDetail(null);
        if (reviewing?.id === id) setReviewing(null);
      },
    });
  };

  const handleExportPDF = () => {
    const toExport = questions.filter((q) => {
      if (tab === "unreviewed") return !q.reviewed;
      if (tab === "reviewed") return q.reviewed;
      if (tab === "due") return !q.reviewed;
      return true;
    });
    if (toExport.length === 0) { alert("没有可导出的错题"); return; }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>错题本导出</title>
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
</style></head>
<body>
  <h1>📝 错题本导出 — ${new Date().toLocaleDateString("zh-CN")}</h1>
  <p style="color:#666;">共 ${toExport.length} 道错题</p>
  ${toExport.map((q) => `
  <div class="card">
    <div><span class="subject">${q.subject}</span>${q.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    <div class="question">${q.question}</div>
    <div class="answer"><strong>答案/解析：</strong>\n${q.answer}</div>
    <div class="meta">来源: ${sourceLabel(q.source)} · 复习次数: ${q.reviewCount} · 添加于: ${new Date(q.createdAt).toLocaleDateString("zh-CN")}</div>
  </div>`).join("\n")}
</body></html>`;

    const win = window.open("", "_blank", "width=800,height=600");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  // ── Derived counts ──
  const unreviewedCount = questions.filter((q) => !q.reviewed).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueTodayCount = questions.filter((q) => {
    if (q.reviewed || !q.nextReviewDate) return false;
    const review = new Date(q.nextReviewDate); review.setHours(0, 0, 0, 0);
    return review <= today;
  }).length;

  const isDue = (q: WrongQuestion) => {
    if (q.reviewed || !q.nextReviewDate) return false;
    const review = new Date(q.nextReviewDate); review.setHours(0, 0, 0, 0);
    return review <= today;
  };

  // ── Render ──
  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">错题本</h1>
            <p className="text-gray-500 mt-1">
              {questions.length > 0
                ? `共 ${questions.length} 道错题，${unreviewedCount} 道待复习${dueTodayCount > 0 ? `，${dueTodayCount} 道今日到期` : ""}`
                : "收集错题，定期复习，巩固薄弱知识点"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBatch(true)}>📥 批量导入</Button>
            <Button variant="outline" onClick={handleExportPDF}>🖨️ 导出</Button>
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
                  tab === k ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {k === "due" && dueTodayCount > 0 && (
                  <span className="ml-1 text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">{dueTodayCount}</span>
                )}
                {k === "unreviewed" && unreviewedCount > 0 && (
                  <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreviewedCount}</span>
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
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
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
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">🔴</div>
            <p className="font-medium">还没有错题</p>
            <p className="text-sm mt-1">去 AI 问答提问后把没掌握的加入错题本，或点击"添加错题"手动添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className={`p-4 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow ${
                  isDue(q) ? "border-l-4 border-l-orange-400"
                    : !q.reviewed ? "border-l-4 border-l-red-400"
                    : "border-l-4 border-l-green-400"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetail(q)}>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">{q.subject}</span>
                      <span className="text-xs text-gray-400">{sourceLabel(q.source)}</span>
                      {isDue(q) ? (
                        <span className="text-xs bg-orange-50 text-orange-500 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">🔔 今日复习</span>
                      ) : !q.reviewed ? (
                        <span className="text-xs bg-red-50 text-red-500 dark:bg-red-900/20 px-1.5 py-0.5 rounded">待复习</span>
                      ) : (
                        <span className="text-xs bg-green-50 text-green-500 dark:bg-green-900/20 px-1.5 py-0.5 rounded">已复习 ×{q.reviewCount}</span>
                      )}
                      {q.nextReviewDate && !q.reviewed && (
                        <span className="text-xs text-gray-400">下次复习：{new Date(q.nextReviewDate).toLocaleDateString("zh-CN")}</span>
                      )}
                      {q.interval > 0 && (
                        <span className="text-xs text-gray-400">间隔 {q.interval} 天 · EF {q.easeFactor.toFixed(1)}</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-2">{q.question}</p>
                    {q.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {q.tags.map((t, i) => (
                          <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setReviewing(q); }}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1" title="复习"
                    >📖</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals — no onSaved/onImported callbacks needed (mutation onSuccess handles invalidation) */}
      {showAdd && (
        <AddModal
          subjects={subjects}
          initialSubject={subjects[0] || ""}
          onClose={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      )}

      {showBatch && (
        <BatchImportModal
          onClose={() => setShowBatch(false)}
          onImported={() => setShowBatch(false)}
        />
      )}

      {reviewing && (
        <ReviewModal
          question={reviewing}
          unreviewedList={questions.filter((q) => !q.reviewed)}
          onClose={() => setReviewing(null)}
          onReviewed={handleReviewed}
        />
      )}

      {detail && (
        <DetailModal
          question={detail}
          onClose={() => setDetail(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
