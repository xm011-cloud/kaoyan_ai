"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Timer, Coffee, Sunrise } from "lucide-react";

interface PomodoroSession {
  id: string;
  type: "focus" | "short_break" | "long_break";
  plannedMinutes: number;
  actualSeconds: number;
  status: string;
  startedAt: string;
  endedAt: string;
  createdAt: string;
}

function formatTimeStr(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const typeConfig: Record<string, { icon: typeof Timer; label: string; color: string }> = {
  focus: { icon: Timer, label: "专注", color: "text-red-500" },
  short_break: { icon: Coffee, label: "短休息", color: "text-green-500" },
  long_break: { icon: Sunrise, label: "长休息", color: "text-blue-500" },
};

export function PomodoroHistory() {
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/pomodoro/sessions?date=${today}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Calculate stats
  const focusSessions = sessions.filter((s) => s.type === "focus" && s.status === "completed");
  const totalFocusSeconds = focusSessions.reduce((sum, s) => sum + s.actualSeconds, 0);
  const totalFocusMinutes = Math.round(totalFocusSeconds / 60);

  const handleSyncToCheckin = async () => {
    if (totalFocusMinutes <= 0) return;
    setSyncing(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // Fetch existing checkin for today
      const checkRes = await fetch(`/api/checkin?date=${today}`);
      const checkData = await checkRes.json();
      const existingDuration = checkData.checkIn?.duration || 0;

      // Upsert checkin with added pomodoro minutes
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          duration: existingDuration + totalFocusMinutes,
          status: "good",
          note: `番茄钟: ${focusSessions.length} 个番茄, 共 ${totalFocusMinutes} 分钟`,
        }),
      });

      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍅</span>
            <div>
              <div className="text-xl font-bold">{focusSessions.length}</div>
              <div className="text-xs text-gray-500">今日番茄</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="text-xl font-bold">{totalFocusMinutes}</div>
              <div className="text-xs text-gray-500">专注分钟</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync to checkin */}
      {focusSessions.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSyncToCheckin}
          disabled={syncing || synced}
        >
          {syncing
            ? "同步中..."
            : synced
              ? "✅ 已记录到打卡"
              : `📝 记录 ${totalFocusMinutes} 分钟到打卡`}
        </Button>
      )}

      {/* Session list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border">
        <h3 className="font-medium px-5 pt-4 pb-2">今日记录</h3>

        {loading ? (
          <div className="px-5 pb-4 text-sm text-gray-400">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="px-5 pb-4 text-center text-gray-400 py-6">
            <span className="text-3xl block mb-2">🍅</span>
            今天还没有番茄记录
            <br />
            <span className="text-xs">开始第一个番茄吧！</span>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {sessions.map((session) => {
              const cfg = typeConfig[session.type] || typeConfig.focus;
              const Icon = cfg.icon;
              const minutes = Math.round(session.actualSeconds / 60);

              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cfg.label}</div>
                    <div className="text-xs text-gray-400">
                      {formatTimeStr(session.startedAt)} - {formatTimeStr(session.endedAt)}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-gray-500">
                    {minutes} 分钟
                  </div>
                  {session.status === "interrupted" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      中断
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
