"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Question {
  id: string;
  subject: string;
  question: string;
  answer: string;
  tags: string[];
  reviewed: boolean;
  interval: number;
}

const RATINGS = [
  { value: 0, label: "完全忘了", color: "bg-red-500 hover:bg-red-600" },
  { value: 1, label: "很模糊", color: "bg-orange-500 hover:bg-orange-600" },
  { value: 2, label: "有点难", color: "bg-yellow-500 hover:bg-yellow-600" },
  { value: 3, label: "还可以", color: "bg-lime-500 hover:bg-lime-600" },
  { value: 4, label: "基本会", color: "bg-emerald-500 hover:bg-emerald-600" },
  { value: 5, label: "很熟练", color: "bg-green-500 hover:bg-green-600" },
];

interface ReviewModalProps {
  question: Question;
  unreviewedList: Question[];
  onClose: () => void;
  onReviewed: (id: string, rating: number) => void;
}

export function ReviewModal({ question, unreviewedList, onClose, onReviewed }: ReviewModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  const handleRate = (rating: number) => {
    onReviewed(question.id, rating);
  };

  const handleSkip = () => {
    const idx = unreviewedList.findIndex((q) => q.id === question.id);
    const next = unreviewedList.slice(idx + 1)[0];
    if (next) {
      onReviewed(question.id, -1); // skip signal
      onClose();
      // Caller should reopen with next
    } else {
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="text-sm font-normal text-muted-foreground">
          📖 复习模式 · {question.subject}
          {question.interval > 0 && ` · 间隔${question.interval}天`}
        </span>
      }
      footer={
        showAnswer ? (
          <div className="w-full">
            <p className="text-xs text-muted-foreground mb-2 text-center">你对这道题的掌握程度？</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleRate(r.value)}
                  className={`min-h-11 rounded-lg px-1 py-2 text-xs font-medium text-white transition-colors ${r.color}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button className="min-h-11 w-full sm:w-auto" variant="outline" size="sm" onClick={handleSkip}>再看看</Button>
              <span className="text-center text-xs text-muted-foreground">0=完全忘了 · 3=还可以 · 5=很熟练</span>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">题目</h4>
            <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed">
              {question.question}
            </div>
          </div>

          {!showAnswer ? (
            <Button variant="outline" className="min-h-11 w-full" onClick={() => setShowAnswer(true)}>
              👆 点击查看答案
            </Button>
          ) : (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">答案/解析</h4>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-sm leading-relaxed border border-green-200 dark:border-green-800">
                {question.answer}
              </div>
            </div>
          )}

          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {question.tags.map((t, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
      </div>
    </Modal>
  );
}
