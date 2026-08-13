/**
 * 专业 → 科目 联动映射（MAJOR_SUBJECT_MAP）
 *
 * 原则：只收录"高确定性"专业——初试科目全国统一，自动填充不会填错。
 * - 公共课确定 / 统考专业课确定 → 自动填
 * - 自主命题专业课永不自动填死（留给用户走"自主:院校-科目"）
 * - 有校际歧义的常见专业（软件工程数一/数二、金融 396/数三）→ 带 note 提示，不静默填错
 * 宁可少填不可错填：错科目 → 错计划，是计划正确性的最上游。
 *
 * 维护：此表是 JSON 配置，考生是领域权威，按实际报考方向增补。
 */
import { isCustomSubject, isPresetSubject } from "./subject-standards";

export interface MajorSubjects {
  /** 确定的统考科目（公共课 + 统考专业课），可安全勾选 */
  subjects: string[];
  /** 歧义说明，有则前端展示黄色提示并要求用户确认 */
  note?: string;
}

export const MAJOR_SUBJECT_MAP: Record<string, MajorSubjects> = {
  // ── 高确定性（自动填安全）──
  "计算机科学与技术": { subjects: ["政治", "英语一", "数学一", "408计算机统考"] },
  "网络空间安全":     { subjects: ["政治", "英语一", "数学一", "408计算机统考"] },
  "教育学":           { subjects: ["政治", "英语一", "311教育学"] },
  "心理学":           { subjects: ["政治", "英语一", "312心理学"] },
  "法律硕士(非法学)": { subjects: ["政治", "英语一", "法硕(非法学)"] },
  "法律硕士(法学)":   { subjects: ["政治", "英语一", "法硕(法学)"] },
  "临床医学":         { subjects: ["政治", "英语一", "西医综合"] },
  "历史学":           { subjects: ["政治", "英语一", "313历史学"] },
  "中医":             { subjects: ["政治", "英语一", "307中医综合"] },
  // 管综系：初试不考政治单科、不考数学单科（数学并入 199 综合）
  "会计":   { subjects: ["英语二", "199管综"], note: "管理类专硕初试不考政治（政治在复试），无需考数学单科" },
  "工商管理": { subjects: ["英语二", "199管综"], note: "管理类专硕初试不考政治（政治在复试），无需考数学单科" },
  "公共管理": { subjects: ["英语二", "199管综"], note: "管理类专硕初试不考政治（政治在复试），无需考数学单科" },

  // ── 歧义专业（自动填 + note 提示，关键科目保持可编辑）──
  "软件工程": { subjects: ["政治", "英语一", "408计算机统考"], note: "部分院校数学考数二而非数一，请按目标院校招生简章确认数学科目" },
  "金融":     { subjects: ["政治"], note: "金融硕士科目差异大（数学三或 396、英语一或二均因校而异），公共课外的科目请按目标院校招生简章手动添加" },
};

/** 规范化专业名并匹配 map，命中返回 map key，未命中返回 null */
export function normalizeMajor(raw: string): string | null {
  const cleaned = (raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
  if (!cleaned) return null;

  // 精确匹配
  if (MAJOR_SUBJECT_MAP[cleaned]) return cleaned;

  // 包含匹配：map key 是输入的子串 → 取最长命中（如 "计算机科学与技术（学硕）" 命中 "计算机科学与技术"）
  const keys = Object.keys(MAJOR_SUBJECT_MAP);
  const hit = keys.filter((k) => cleaned.includes(k)).sort((a, b) => b.length - a.length)[0];
  return hit || null;
}

/** 将推荐科目合并进当前已选（只增不删，尊重用户已有的手动选择） */
export function mergeRecommendedSubjects(current: string[], recommended: string[]): string[] {
  const result = [...current];
  for (const r of recommended) {
    if (!result.includes(r)) result.push(r);
  }
  return result;
}

/** 是否只含推荐里也覆盖的"核心公共课"（政治/英语一/英语二）——用于安全补全，不碰数学与专业课 */
const CORE_PUBLIC = new Set(["政治", "英语一", "英语二"]);
export function mergeMissingCorePublic(current: string[], recommended: string[]): string[] {
  let changed = false;
  const result = [...current];
  for (const r of recommended) {
    if (CORE_PUBLIC.has(r) && !result.includes(r)) {
      result.push(r);
      changed = true;
    }
  }
  return changed ? result : current;
}

/** 判断已选科目中是否含"自定义产物"（自主命题或旧格式），有则视为用户深度定制，不再自动补专业课 */
export function hasCustomizedSubjects(subjects: string[]): boolean {
  return subjects.some((s) => isCustomSubject(s) || !isPresetSubject(s));
}
