"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useBatchImportWrongQuestions } from "@/hooks/use-wrong-questions";
import { toast } from "@/stores/toast-store";

interface BatchImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function BatchImportModal({ onClose, onImported }: BatchImportModalProps) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"text" | "json">("text");
  const [importing, setImporting] = useState(false);
  const { mutate } = useBatchImportWrongQuestions();

  const handleImport = () => {
    if (!text.trim()) return;
    setImporting(true);
    try {
      const body = format === "json" ? { questions: JSON.parse(text) } : { text };
      mutate(body, {
        onSuccess: (data: { count: number }) => {
          onImported();
          onClose();
          toast.success(`成功导入 ${data.count} 道错题`);
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "导入失败");
        },
        onSettled: () => setImporting(false),
      });
    } catch (err) {
      toast.error(err instanceof SyntaxError ? "JSON 格式错误，请检查" : "导入失败");
      setImporting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="批量导入错题"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleImport} disabled={importing || !text.trim()}>
            {importing ? "导入中..." : "导入"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
          <div className="flex gap-2">
            {(["text", "json"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  format === f ? "bg-brand-muted text-brand font-medium" : "bg-muted text-muted-foreground"
                }`}
              >
                {f === "text" ? "文本格式" : "JSON 格式"}
              </button>
            ))}
          </div>

          {format === "text" ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                用 <code className="bg-muted px-1 rounded">---</code> 分隔每道题
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm resize-y font-mono focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder={`科目：高等数学\n题目：求极限 lim(x→0) (sin x)/x\n答案：1，使用重要极限公式\n标签：极限, 重要公式\n---\n科目：英语\n题目：The professor required ...`}
              />
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2">粘贴 JSON 数组</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm resize-y font-mono focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder='[{"subject":"...","question":"...","answer":"...","tags":[...]}]'
              />
            </div>
          )}
      </div>
    </Modal>
  );
}
