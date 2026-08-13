/**
 * 科目标准化 — 统考预设 + 自主命题前缀
 *
 * 设计原则：
 * - 统考科目用固定列表（checkbox 选择）
 * - 自主命题科目用 "自主:院校-科目名" 前缀格式
 * - 不做 DB 迁移（历史数据保持原样，新保存时规范化）
 */

// ── 预设统考科目 ──
export interface PresetSubject {
  value: string;
  label: string;
  category: "公共课" | "专业课";
}

export const PRESET_SUBJECTS: PresetSubject[] = [
  // 公共课
  { value: "政治", label: "政治", category: "公共课" },
  { value: "英语一", label: "英语一", category: "公共课" },
  { value: "英语二", label: "英语二", category: "公共课" },
  // 数学
  { value: "数学一", label: "数学一", category: "公共课" },
  { value: "数学二", label: "数学二", category: "公共课" },
  { value: "数学三", label: "数学三", category: "公共课" },
  // 统考专业课
  { value: "408计算机统考", label: "408 计算机学科专业基础综合", category: "专业课" },
  { value: "311教育学", label: "311 教育学专业基础综合", category: "专业课" },
  { value: "312心理学", label: "312 心理学专业基础综合", category: "专业课" },
  { value: "法硕(非法学)", label: "法硕(非法学)", category: "专业课" },
  { value: "法硕(法学)", label: "法硕(法学)", category: "专业课" },
  { value: "西医综合", label: "西医综合 (306)", category: "专业课" },
  { value: "313历史学", label: "313 历史学专业基础综合", category: "专业课" },
  { value: "307中医综合", label: "307 临床医学综合能力(中医)", category: "专业课" },
  { value: "199管综", label: "199 管理类综合能力", category: "专业课" },
  { value: "396经综", label: "396 经济类联考综合能力", category: "专业课" },
];

// ── 自主命题前缀 ──
export const CUSTOM_SUBJECT_PREFIX = "自主:";

// ── 工具函数 ──

/** 判断是否为预设统考科目 */
export function isPresetSubject(subject: string): boolean {
  return PRESET_SUBJECTS.some((s) => s.value === subject);
}

/** 判断是否为自主命题科目（带前缀） */
export function isCustomSubject(subject: string): boolean {
  return subject.startsWith(CUSTOM_SUBJECT_PREFIX);
}

/**
 * 解析自主命题科目的院校和科目名
 * "自主:北京大学-数据结构与算法" → { university: "北京大学", subject: "数据结构与算法" }
 */
export function parseCustomSubject(subject: string): { university: string; subject: string } | null {
  if (!isCustomSubject(subject)) return null;
  const rest = subject.slice(CUSTOM_SUBJECT_PREFIX.length);
  const idx = rest.indexOf("-");
  if (idx === -1) return { university: rest, subject: "" };
  return { university: rest.slice(0, idx), subject: rest.slice(idx + 1) };
}

/**
 * 规范化科目名（兼容历史自由文本数据）
 * - 精确匹配预设 → 返回预设值
 * - 模糊匹配预设（忽略空白） → 返回预设值
 * - 已有自主前缀 → 保持不变
 * - 其他 → 保持原样（不做强制转换，避免误改历史数据）
 */
export function normalizeSubject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // 已有自主前缀 → 保持
  if (trimmed.startsWith(CUSTOM_SUBJECT_PREFIX)) return trimmed;

  // 精确匹配预设
  if (PRESET_SUBJECTS.some((s) => s.value === trimmed)) return trimmed;

  // 宽松匹配（去空格后比较）
  const compact = trimmed.replace(/\s+/g, "");
  for (const s of PRESET_SUBJECTS) {
    if (s.value.replace(/\s+/g, "") === compact) return s.value;
  }

  // 常见简写映射
  const ALIASES: Record<string, string> = {
    "数一": "数学一", "数二": "数学二", "数三": "数学三",
    "英一": "英语一", "英二": "英语二",
    "408": "408计算机统考", "311": "311教育学", "312": "312心理学",
    "313": "313历史学", "307": "307中医综合", "199": "199管综", "396": "396经综",
    "历史学": "313历史学", "管理类综合能力": "199管综", "管理类联考综合能力": "199管综",
  };
  if (ALIASES[trimmed]) return ALIASES[trimmed];

  // 不做强制转换
  return trimmed;
}

/** 从自主命题科目生成显示文本 */
export function formatCustomSubjectLabel(subject: string): string {
  const parsed = parseCustomSubject(subject);
  if (!parsed) return subject;
  return `${parsed.university} · ${parsed.subject}`;
}

/** 获取所有预设科目值（用于 API 返回） */
export function getPresetSubjectValues(): string[] {
  return PRESET_SUBJECTS.map((s) => s.value);
}
