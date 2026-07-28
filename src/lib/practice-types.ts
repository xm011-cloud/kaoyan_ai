/**
 * Practice/练习 共享类型
 *
 * 从 practice-generator.ts 和 practice/page.tsx 提取，
 * 确保前后端使用一致的类型定义。
 */

export interface PracticeQuestion {
  id: string;
  type: "choice" | "essay";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  scoringPoints?: string[];
}

export interface PracticeSession {
  id: string;
  type: "daily" | "mock";
  subject: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: PracticeQuestion[];
  answers: Record<string, string>;
  scores: Record<string, { score: number; maxScore: number; feedback: string }>;
  totalScore: number | null;
  maxScore: number | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
