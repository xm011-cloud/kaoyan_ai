"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PracticeSession } from "@/lib/practice-types";

async function fetchSessions(limit = 30): Promise<PracticeSession[]> {
  const res = await fetch(`/api/practice?limit=${limit}`);
  if (!res.ok) throw new Error("获取练习记录失败");
  const data = await res.json();
  return data.sessions || [];
}

async function fetchSessionDetail(id: string): Promise<PracticeSession> {
  const res = await fetch(`/api/practice/${id}`);
  if (!res.ok) throw new Error("获取练习详情失败");
  const data = await res.json();
  return data.session;
}

async function createSession(body: {
  type: "daily" | "mock";
  subject: string;
  duration?: number;
  materialIds?: string[];
  wrongQuestionIds?: string[];
}): Promise<PracticeSession> {
  const res = await fetch("/api/practice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("创建练习失败");
  const data = await res.json();
  return data.session;
}

async function submitAnswers(
  id: string,
  answers: Record<string, string>
): Promise<PracticeSession> {
  const res = await fetch(`/api/practice/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("提交失败");
  const data = await res.json();
  return data.session;
}

// ── Hooks ──

export function usePracticeSessions(limit = 30) {
  return useQuery({
    queryKey: ["practice-sessions", limit],
    queryFn: () => fetchSessions(limit),
  });
}

export function usePracticeSessionDetail(id: string) {
  return useQuery({
    queryKey: ["practice-sessions", id],
    queryFn: () => fetchSessionDetail(id),
    enabled: !!id,
  });
}

export function useCreatePracticeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-sessions"] }),
  });
}

export function useSubmitPracticeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: Record<string, string> }) =>
      submitAnswers(id, answers),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-sessions"] }),
  });
}
