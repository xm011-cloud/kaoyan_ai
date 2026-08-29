"use client";

import { useQuery } from "@tanstack/react-query";
import type { SubjectProgress } from "@/lib/completion";

interface GoalData {
  id: string;
  university: string;
  major: string;
  examDate: string;
  subjects: string[];
  targetScores?: Record<string, number>;
  progress?: Record<string, SubjectProgress>;
  studyLoad?: { weeklyHours?: number; busyWeeks?: string[] };
}

async function fetchGoal(): Promise<GoalData | null> {
  const res = await fetch("/api/goal");
  if (!res.ok) return null;
  const data = await res.json();
  return data.goal || null;
}

/** 获取用户考研目标（自动缓存，1 分钟 stale） */
export function useGoal() {
  return useQuery({
    queryKey: ["goal"],
    queryFn: fetchGoal,
    staleTime: 60 * 1000,
  });
}

/** 从目标中提取科目列表 */
export function useSubjects() {
  const { data: goal } = useGoal();
  return goal?.subjects ?? [];
}
