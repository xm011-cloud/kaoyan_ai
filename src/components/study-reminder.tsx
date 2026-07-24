"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface ReminderSettings {
  reminderEnabled: boolean;
  reminderTime: string;   // "HH:MM"
  reminderDays: string[]; // ["1","2","3","4","5"]
}

function notify(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", tag: "study-reminder" });
    }
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = "sine";
    gain.gain.value = 0.2;
    // Play a pleasant two-tone chime
    osc.start(ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Web Audio not supported
  }
}

export function StudyReminder() {
  const lastTriggeredRef = useRef<string>(""); // "YYYY-MM-DD HH:MM" to avoid double-fire
  const settingsRef = useRef<ReminderSettings | null>(null);
  const lastFetchRef = useRef<number>(0);

  const checkReminder = useCallback(async () => {
    try {
      const now = Date.now();

      // Only re-fetch settings every 5 minutes
      if (!settingsRef.current || now - lastFetchRef.current > 300_000) {
        const res = await fetch("/api/user/reminders");
        settingsRef.current = await res.json();
        lastFetchRef.current = now;
      }

      const data = settingsRef.current;
      if (!data || !data.reminderEnabled || !data.reminderTime) return;

      const currentDate = new Date();
      const currentDay = String(currentDate.getDay() === 0 ? 7 : currentDate.getDay()); // 1=Mon..7=Sun
      const currentTime = `${String(currentDate.getHours()).padStart(2, "0")}:${String(currentDate.getMinutes()).padStart(2, "0")}`;

      // Check if today is a reminder day
      if (!data.reminderDays.includes(currentDay)) return;

      // Check if current time matches reminder time (within 1 minute)
      if (currentTime !== data.reminderTime) return;

      // Prevent double-firing in the same minute
      const triggerKey = `${currentDate.toISOString().split("T")[0]} ${currentTime}`;
      if (lastTriggeredRef.current === triggerKey) return;
      lastTriggeredRef.current = triggerKey;

      notify("📚 学习时间到！", "该开始今天的学习啦，坚持下去就是胜利 💪");
      playBeep();
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    // Request notification permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // Check every 5 minutes (300s) instead of 45s
    const interval = setInterval(checkReminder, 300_000);

    // Also check once on mount (with a small delay to let page load)
    const timeout = setTimeout(checkReminder, 3_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkReminder]);

  // This component renders nothing - it's purely a background service
  return null;
}
