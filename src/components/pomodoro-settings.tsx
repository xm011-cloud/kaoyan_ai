"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PomodoroSettingsData {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
}

interface PomodoroSettingsProps {
  settings: PomodoroSettingsData;
  onSave: (settings: PomodoroSettingsData) => void;
  onClose: () => void;
}

const labelClass = "block text-sm font-medium mb-1";
const inputClass =
  "w-full h-10 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20";

export function PomodoroSettings({
  settings,
  onSave,
  onClose,
}: PomodoroSettingsProps) {
  const [form, setForm] = useState<PomodoroSettingsData>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/pomodoro/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }

      onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">⚙️ 番茄钟设置</h3>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭">
          ✕
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>专注时长 (分钟)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={form.focusMinutes}
              onChange={(e) =>
                setForm({ ...form, focusMinutes: parseInt(e.target.value) || 25 })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>短休息 (分钟)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.shortBreakMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  shortBreakMinutes: parseInt(e.target.value) || 5,
                })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>长休息 (分钟)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={form.longBreakMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  longBreakMinutes: parseInt(e.target.value) || 15,
                })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>长休息间隔 (番茄数)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.longBreakInterval}
              onChange={(e) =>
                setForm({
                  ...form,
                  longBreakInterval: parseInt(e.target.value) || 4,
                })
              }
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && (
          <p className="text-success text-sm">✅ 设置已保存</p>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </form>
    </div>
  );
}
