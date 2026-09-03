"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanningIntakeAnalysis, PlanningInterviewAnswers } from "@/lib/study-profile";

interface SavedFact {
  id: string;
  key: string;
  label: string;
  value: unknown;
  source: string;
  confidence: string;
}

const SOURCE_LABELS: Record<string, string> = {
  user_statement: "你明确说过",
  self_assessment: "你的自评",
  assessment: "测评结果",
  behavior: "学习记录",
  ai_inference: "AI 推断",
};

function statementFromFacts(facts: SavedFact[]) {
  const raw = facts.find((fact) => fact.key === "planning.statement")?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const text = (raw as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

export function PlanningIntakeCard() {
  const [statement, setStatement] = useState("");
  const [savedFacts, setSavedFacts] = useState<SavedFact[]>([]);
  const [analysis, setAnalysis] = useState<PlanningIntakeAnalysis | null>(null);
  const [answers, setAnswers] = useState<PlanningInterviewAnswers>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadFacts = useCallback(async () => {
    const res = await fetch("/api/study-profile");
    const data = await res.json();
    if (!res.ok) return;
    const facts = Array.isArray(data.facts) ? data.facts : [];
    setSavedFacts(facts);
    setStatement((current) => current || statementFromFacts(facts));
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/study-profile")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        const facts = Array.isArray(data.facts) ? data.facts : [];
        setSavedFacts(facts);
        setStatement(statementFromFacts(facts));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function submit(action: "analyze" | "confirm") {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, statement, answers: action === "confirm" ? answers : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析失败");
      setAnalysis(data.analysis);
      if (action === "confirm") {
        await loadFacts();
        setMessage("✅ 已写入长期学习档案。以后生成路线和调整计划都会参考这些已确认事实。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function rejectFact(id: string) {
    setMessage("");
    const res = await fetch(`/api/study-profile?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "撤回失败");
      return;
    }
    await loadFacts();
    setMessage("已撤回这条记忆，后续规划不会再使用它。");
  }

  const extractedFacts = analysis?.facts.filter((fact) => fact.key !== "planning.statement") ?? [];
  const visibleSavedFacts = savedFacts.filter((fact) => fact.key !== "planning.statement");

  return (
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-6" aria-labelledby="planning-intake-title">
      <div>
        <h2 id="planning-intake-title" className="text-lg font-bold">先说说你的目标和当前情况</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          可以像聊天一样描述。系统会先复述理解和列出待确认问题，不会直接生成一堆任务。
        </p>
      </div>

      <div>
        <label htmlFor="planning-statement" className="mb-1 block text-sm font-medium">你的原话</label>
        <textarea
          id="planning-statement"
          value={statement}
          onChange={(event) => {
            setStatement(event.target.value);
            setAnalysis(null);
            setAnswers({});
            setMessage("");
          }}
          rows={5}
          maxLength={2000}
          placeholder="例如：我想考研，但 408 还有计算机网络没学，数学基础也弱，英语四级过了六级没过。我想学完没完成的课程，同时补一遍所有课程的基础。"
          className="w-full rounded-xl border border-border/50 bg-muted/40 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{statement.length}/2000</p>
      </div>

      <Button type="button" variant="outline" onClick={() => submit("analyze")} disabled={loading || !statement.trim()}>
        {loading ? "分析中..." : "先看看系统怎么理解"}
      </Button>

      {analysis && (
        <div className="space-y-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div>
            <p className="text-sm font-semibold">我们的当前理解</p>
            <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>
          </div>

          {extractedFacts.length > 0 && (
            <ul className="space-y-2">
              {extractedFacts.map((fact) => (
                <li key={fact.key} className="rounded-lg bg-background/80 px-3 py-2 text-sm">
                  <span className="font-medium">{fact.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {SOURCE_LABELS[fact.source] || fact.source} · {fact.confidence === "high" ? "高可信" : "需要后续校准"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3">
            <p className="text-sm font-semibold">设计长期路线前还要逐步确认</p>
            {analysis.questions.map((question) => (
              <div key={question.key} className="rounded-lg border border-border/50 bg-background/70 p-3">
                <label htmlFor={"planning-interview-" + question.key} className="block text-sm font-medium">{question.label}</label>
                <p className="mt-1 text-xs text-muted-foreground">{question.help}</p>
                {question.kind === "choice" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.options?.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswers((current) => ({ ...current, [question.key]: option }))}
                        className={answers[question.key] === option
                          ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                          : "rounded-full border border-border/60 px-3 py-1.5 text-xs hover:border-brand/50"}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    id={"planning-interview-" + question.key}
                    type={question.kind === "number" ? "number" : "text"}
                    min={question.kind === "number" ? 1 : undefined}
                    max={question.kind === "number" ? 80 : undefined}
                    value={answers[question.key] === "__unknown__" ? "" : (answers[question.key] || "")}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                    placeholder={question.kind === "number" ? "例如 12" : "写下你的回答"}
                    className="mt-2 h-10 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                )}
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setAnswers((current) => ({ ...current, [question.key]: "__unknown__" }))}
                >
                  {answers[question.key] === "__unknown__" ? "已标记为暂时不确定" : "暂时不确定，以后再问"}
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            如果理解不准确，请直接修改上面的原话再分析。你可以回答、标记暂不确定或跳过；点击确认后才会成为长期记忆。
          </p>
          <Button type="button" onClick={() => submit("confirm")} disabled={loading}>
            确认这些情况，写入长期档案
          </Button>
        </div>
      )}

      {message && <p className="text-sm" role="status">{message}</p>}

      {visibleSavedFacts.length > 0 && !analysis && (
        <details className="rounded-xl border border-border/50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">已确认的长期档案（{visibleSavedFacts.length}）</summary>
          <ul className="mt-3 space-y-2">
            {visibleSavedFacts.map((fact) => (
              <li key={fact.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {fact.label}
                  <span className="ml-2 text-xs text-muted-foreground">{SOURCE_LABELS[fact.source] || fact.source}</span>
                </span>
                <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-destructive" onClick={() => rejectFact(fact.id)}>
                  不再使用
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
