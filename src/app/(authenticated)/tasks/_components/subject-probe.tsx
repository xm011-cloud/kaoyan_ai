"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, type SubjectStage } from "@/lib/completion";

export interface ProbeResult {
  calibratedStage: SubjectStage;
  evidence: string;
  suggestion: string;
  confirmed: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subject: string;
  /** 当前自评档位 */
  stage: SubjectStage;
  onAccept: (r: ProbeResult) => void;
  onKeep: () => void;
}

/**
 * 对话式掌握度校准（完成度模型 v3 0.2）
 * 三步：生成问题 → 用户逐题回答 → 评估结果（保守：答得差判低一档）。
 */
export function SubjectProbeModal({ open, onClose, subject, stage, onAccept, onKeep }: Props) {
  const [step, setStep] = useState<"loading" | "questions" | "result">("loading");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/ai/probe-mastery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, stage }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setStep("questions");
          return;
        }
        setQuestions(d.questions || []);
        setStep("questions");
      })
      .catch(() => {
        if (!cancelled) {
          setError("请求失败，请稍后再试");
          setStep("questions");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, subject, stage]);

  const submitAnswers = async () => {
    if (!answers.trim()) return;
    setEvaluating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/probe-mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, stage, answers }),
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      setResult(d as ProbeResult);
      setStep("result");
    } catch {
      setError("请求失败，请稍后再试");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`🤔 确认「${subject}」的掌握度`}
      description={`你自评为「${STAGE_LABELS[stage]}」。系统对你的自评持保守态度，用几个问题确认一下，不判分、不打脸。`}
      size="sm"
    >
      <div className="space-y-3">
        {step === "loading" && <p className="text-sm text-muted-foreground">正在根据你的学习内容生成问题…</p>}

        {step === "questions" && (
          <>
            {error && <p className="text-xs text-warning">{error}</p>}
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl bg-muted/40 p-3 text-sm">
                <span className="font-medium">{i + 1}. </span>
                {q}
              </div>
            ))}
            <textarea
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              rows={4}
              placeholder="逐题回答（能说清为什么最好，只说答案也可以）"
              className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <Button onClick={submitAnswers} disabled={evaluating} className="w-full">
              {evaluating ? "评估中…" : "提交回答"}
            </Button>
          </>
        )}

        {step === "result" && result && (
          <>
            <p className="text-sm">
              根据刚才的交流，判断你的「{subject}」处于{" "}
              <b className="text-brand">{STAGE_LABELS[result.calibratedStage]}</b> 档位。
            </p>
            {!result.confirmed && (
              <p className="text-xs text-warning">
                和你的自评（{STAGE_LABELS[stage]}）不一致——采纳后，计划会按校准结果（保守）安排基础巩固。
              </p>
            )}
            <p className="text-xs text-muted-foreground">{result.evidence}</p>
            <p className="text-xs">💡 {result.suggestion}</p>
            <div className="flex gap-2">
              <Button onClick={() => onAccept(result)} className="flex-1">
                {result.confirmed ? "确认采纳" : "采纳校准结果"}
              </Button>
              <Button variant="outline" onClick={onKeep} className="flex-1">
                保持自评
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
