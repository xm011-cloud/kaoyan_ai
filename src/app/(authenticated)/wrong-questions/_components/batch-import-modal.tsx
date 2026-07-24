"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BatchImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function BatchImportModal({ onClose, onImported }: BatchImportModalProps) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"text" | "json">("text");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!text.trim()) return;
    setImporting(true);
    try {
      const body = format === "json" ? { questions: JSON.parse(text) } : { text };
      const res = await fetch("/api/wrong-questions/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onImported();
        onClose();
        alert(`✅ 成功导入 ${data.count} 道错题`);
      } else {
        alert(data.error || "导入失败");
      }
    } catch (err) {
      alert(err instanceof SyntaxError ? "JSON 格式错误，请检查" : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg">批量导入错题</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2">
            {(["text", "json"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  format === f ? "bg-blue-100 text-blue-700 font-medium" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {f === "text" ? "文本格式" : "JSON 格式"}
              </button>
            ))}
          </div>

          {format === "text" ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                用 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">---</code> 分隔每道题
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y font-mono"
                placeholder={`科目：高等数学\n题目：求极限 lim(x→0) (sin x)/x\n答案：1，使用重要极限公式\n标签：极限, 重要公式\n---\n科目：英语\n题目：The professor required ...`}
              />
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">粘贴 JSON 数组</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 resize-y font-mono"
                placeholder='[{"subject":"...","question":"...","answer":"...","tags":[...]}]'
              />
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex gap-2 justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleImport} disabled={importing || !text.trim()}>
            {importing ? "导入中..." : "导入"}
          </Button>
        </div>
      </div>
    </div>
  );
}
