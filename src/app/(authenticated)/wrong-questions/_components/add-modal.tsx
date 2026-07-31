"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCreateWrongQuestion } from "@/hooks/use-wrong-questions";

interface AddForm {
  subject: string;
  question: string;
  answer: string;
  tags: string;
}

interface AddModalProps {
  subjects: string[];
  initialSubject: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddModal({ subjects, initialSubject, onClose, onSaved }: AddModalProps) {
  const [form, setForm] = useState<AddForm>({
    subject: initialSubject || "",
    question: "",
    answer: "",
    tags: "",
  });
  const { mutate, isPending: saving } = useCreateWrongQuestion();

  const handleAdd = () => {
    if (!form.subject || !form.question || !form.answer) return;
    mutate(
      {
        subject: form.subject,
        question: form.question,
        answer: form.answer,
        source: "manual",
        tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-lg">添加错题</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="关闭">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">科目</label>
            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">选择科目</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="其他">其他</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">题目</label>
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y"
              placeholder="输入题目内容..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">答案/解析</label>
            <textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y"
              placeholder="输入正确答案和解析..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              placeholder="如：极限, 连续性, 导数"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleAdd} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </div>
      </div>
    </div>
  );
}
