"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AiWaiting } from "@/components/ai-waiting";
import { useAiTask } from "@/hooks/use-ai-task";
import type { PlanIntent, PlanIntentType } from "@/app/api/ai/judge-plan-intent/route";

const INTENT_LABELS: Record<PlanIntentType, string> = {
  kaoyan: "考研备考计划",
  course: "课程/期末复习计划",
  selfstudy: "自学计划",
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** 确认后生成计划（planContext 传给 generate-plan） */
  onConfirm: (intent: PlanIntent) => void;
}

/**
 * 探索期计划意图确认（0.4b / D4 种子）
 * 用户描述需求 → AI 判断计划类型 → 生成前展示确认卡（让用户知道会生成什么）。
 */
export function PlanIntentModal({ open, onClose, onConfirm }: Props) {
  const [description, setDescription] = useState("");
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<PlanIntent | null>(null);
  const { phase, estimate, start, stop, cancel } = useAiTask();

  const judge = async () => {
    if (!description.trim()) return;
    setJudging(true);
    setError("");
    const controller = start();
    try {
      const res = await fetch("/api/ai/judge-plan-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      setIntent(d.intent);
    } catch {
      // 用户取消（AbortError）安静收场；其他网络错误给提示
      if (!controller.signal.aborted) setError("请求失败，请稍后再试");
    } finally {
      stop();
      setJudging(false);
    }
  };

  const reset = () => {
    setIntent(null);
    setError("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📝 生成学习计划"
      description="还没有设置考研目标？没关系——描述你想学什么，我们先判断计划类型，生成前会告诉你是什么计划。"
    >
      <div className="space-y-3">
        {!intent ? (
          <>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="例：我要考研，考计算机，政治英语一数一408 / 期末高数想考 90 / 自学 Python 打基础"
              className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {error && <p className="text-xs text-warning">{error}</p>}
            {judging ? (
              <AiWaiting variant="inline" phase={phase} estimate={estimate} onCancel={cancel} />
            ) : (
              <Button onClick={judge} disabled={!description.trim()} className="w-full">
                判断计划类型
              </Button>
            )}
          </>
        ) : (
          <>
            {/* 生成前确认卡 */}
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 space-y-1.5">
              <p className="text-sm font-medium">将为你生成【{INTENT_LABELS[intent.type]}】</p>
              <p className="text-xs text-muted-foreground">{intent.summary}</p>
              {intent.subjects && intent.subjects.length > 0 && (
                <p className="text-xs text-muted-foreground">科目：{intent.subjects.join("、")}</p>
              )}
              <p className="text-[11px] text-muted-foreground/80">
                确认后按这个类型生成本周计划；科目/内容可在生成后调整。
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onConfirm(intent)} className="flex-1">
                确认生成
              </Button>
              <Button variant="outline" onClick={reset} className="flex-1">
                重新描述
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
