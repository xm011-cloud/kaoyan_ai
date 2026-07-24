"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WrongQuestion {
  id: string;
  subject: string;
  question: string;
  answer: string;
  source: string;
  tags: string[];
  reviewed: boolean;
  reviewCount: number;
  easeFactor: number;
  interval: number;
  nextReviewDate: string | null;
  createdAt: string;
}

interface FetchParams {
  subject?: string;
  reviewed?: string;
  source?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

async function fetchList(params: FetchParams): Promise<{
  questions: WrongQuestion[];
  total: number;
}> {
  const sp = new URLSearchParams();
  if (params.subject) sp.set("subject", params.subject);
  if (params.reviewed) sp.set("reviewed", params.reviewed);
  if (params.source) sp.set("source", params.source);
  if (params.tag) sp.set("tag", params.tag);
  if (params.search) sp.set("search", params.search);
  sp.set("page", String(params.page || 1));
  sp.set("limit", String(params.limit || 20));

  const res = await fetch(`/api/wrong-questions?${sp}`);
  if (!res.ok) throw new Error("获取错题列表失败");
  return res.json();
}

async function createQuestion(body: {
  subject: string;
  question: string;
  answer: string;
  tags?: string[];
  source?: string;
}): Promise<{ question: WrongQuestion }> {
  const res = await fetch("/api/wrong-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || "添加失败");
  }
  return res.json();
}

async function updateQuestion(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/wrong-questions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("更新失败");
  return res.json();
}

async function deleteQuestion(id: string) {
  const res = await fetch(`/api/wrong-questions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除失败");
}

async function batchImport(body: { questions?: unknown[]; text?: string }) {
  const res = await fetch("/api/wrong-questions/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("批量导入失败");
  return res.json();
}

export function useWrongQuestions(params: FetchParams) {
  return useQuery({
    queryKey: ["wrong-questions", params],
    queryFn: () => fetchList(params),
    placeholderData: (prev) => prev, // 翻页时保持旧数据
  });
}

export function useCreateWrongQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wrong-questions"] }),
  });
}

export function useUpdateWrongQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      updateQuestion(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wrong-questions"] }),
  });
}

export function useDeleteWrongQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQuestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wrong-questions"] }),
  });
}

export function useBatchImportWrongQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: batchImport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wrong-questions"] }),
  });
}
