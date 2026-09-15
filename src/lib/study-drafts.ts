"use client";

export type CourseSessionDraft = {
  lessonId: string;
  sessionId: string;
  noteContent: string;
  noteKind: string;
  assessment: string;
  blocker: string;
  nextStep: string;
  savedAt: number;
};

const courseKey = (sessionId: string) => `c6:course-draft:${sessionId}`;
const weeklyKey = (weekStart: string) => `c6:weekly-adjustment:${weekStart}`;

export function loadCourseDraft(sessionId: string): CourseSessionDraft | null {
  try {
    const value = localStorage.getItem(courseKey(sessionId));
    if (!value) return null;
    const draft = JSON.parse(value) as CourseSessionDraft;
    return draft.sessionId === sessionId ? draft : null;
  } catch { return null; }
}

export function saveCourseDraft(draft: CourseSessionDraft) {
  try { localStorage.setItem(courseKey(draft.sessionId), JSON.stringify(draft)); } catch { /* ignore */ }
}

export function clearCourseDraft(sessionId: string) {
  try { localStorage.removeItem(courseKey(sessionId)); } catch { /* ignore */ }
}

export function loadWeeklyAdjustment(weekStart: string): string {
  try { return localStorage.getItem(weeklyKey(weekStart)) ?? ""; } catch { return ""; }
}

export function saveWeeklyAdjustment(weekStart: string, value: string) {
  try { localStorage.setItem(weeklyKey(weekStart), value); } catch { /* ignore */ }
}

export function clearWeeklyAdjustment(weekStart: string) {
  try { localStorage.removeItem(weeklyKey(weekStart)); } catch { /* ignore */ }
}
