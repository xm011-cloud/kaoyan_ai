import { NextResponse } from "next/server";
import { PRESET_SUBJECTS } from "@/lib/subject-standards";

/**
 * GET /api/subjects — 返回预设科目列表（无需认证）
 *
 * 用于前端科目选择器获取可选项。
 * 按 category 分组返回，方便 UI 渲染。
 */
export async function GET() {
  const byCategory: Record<string, { value: string; label: string }[]> = {};

  for (const s of PRESET_SUBJECTS) {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push({ value: s.value, label: s.label });
  }

  return NextResponse.json({
    categories: Object.entries(byCategory).map(([name, subjects]) => ({
      name,
      subjects,
    })),
    all: PRESET_SUBJECTS.map((s) => ({ value: s.value, label: s.label })),
  });
}
