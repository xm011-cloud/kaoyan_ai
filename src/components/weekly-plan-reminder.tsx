"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGoal } from "@/hooks/use-goal";
import { getWeekStart, toDateString } from "@/lib/date-utils";

const STORAGE_KEY = "weeklyPlanPrompted";

/** 本地 YYYY-MM-DD。注意：toDateString 基于 UTC（东八区会得到前一天），
 *  而 URL ?week= 需要本地周一日期，两者语义不同，必须分开用。 */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 周计划到期提醒 — 周日登录时检测"下周无计划"，提示生成下周计划。
 * 挂载在 (authenticated)/layout.tsx，全局生效（不只限任务页）。
 * 防打扰：localStorage 记录已提示的下周一日期，每周仅弹一次。
 */
export function WeeklyPlanReminder() {
  const router = useRouter();
  const { data: goal } = useGoal();
  const [show, setShow] = useState(false);
  const [nextMonday, setNextMonday] = useState("");
  const checkedRef = useRef(false);

  useEffect(() => {
    // 只检查一次；无目标不打扰
    if (checkedRef.current || show) return;
    if (!goal) return; // undefined=加载中, null=未设目标 → 都跳过

    const today = new Date();
    if (today.getDay() !== 0) {
      checkedRef.current = true;
      return; // 非周日
    }

    // 下周周一
    const nm = new Date(getWeekStart(today));
    nm.setDate(nm.getDate() + 7);
    const nmNav = toLocalDate(nm); // 本地周一 → 用于 /tasks?week= 导航 + 防打扰 key
    const nmCheck = toDateString(nm); // 周一的 UTC 日期 → 用于 /api/tasks?weekStart=（与 generate-plan 存储/查询语义一致）
    setNextMonday(nmNav);

    // 本周已提示过 → 跳过
    try {
      if (localStorage.getItem(STORAGE_KEY) === nmNav) {
        checkedRef.current = true;
        return;
      }
    } catch {
      /* ignore */
    }

    // 下周是否已有计划
    fetch(`/api/tasks?weekStart=${nmCheck}`)
      .then((res) => res.json())
      .then((data) => {
        checkedRef.current = true;
        if ((data.tasks || []).length === 0) setShow(true);
      })
      .catch(() => {
        checkedRef.current = true;
      });
  }, [goal, show]);

  const handleGenerate = () => {
    try {
      localStorage.setItem(STORAGE_KEY, nextMonday);
    } catch {
      /* ignore */
    }
    router.push(`/tasks?week=${nextMonday}&generate=1`);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, nextMonday);
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleDismiss}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h3 className="font-bold">本周计划已结束</h3>
            <p className="text-sm text-gray-500 mt-1">
              下周计划还未生成，现在安排下周的学习任务吗？
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            今天先不用
          </Button>
          <Button className="flex-1" onClick={handleGenerate}>
            生成下周计划
          </Button>
        </div>
      </div>
    </div>
  );
}
