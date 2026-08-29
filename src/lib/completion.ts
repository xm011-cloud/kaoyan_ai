/**
 * 完成度模型 v3 — 科目学习状态（五档 + 科目感知 + 保守处理）
 *
 * 见 docs/completion-model.md。核心思想：
 * - 自评档位 = "假设"（意愿），不是事实 → 标"待确认"
 * - 对话校准档位优先（有效档位 = calibratedStage ?? stage ?? 按 percent 推断）
 * - 保守：未校准的高档位 → 需要确认；接近满分 → 温和质疑
 * - percent 降级为微调（默认由档位映射），保留兼容
 */

// ── 五档 ──
export type SubjectStage =
  | "not_started" // 未开始
  | "learning" // 学习中
  | "foundation" // 基础完成
  | "intensifying" // 强化中
  | "mastering"; // 冲刺/掌握

export const STAGE_ORDER: SubjectStage[] = [
  "not_started",
  "learning",
  "foundation",
  "intensifying",
  "mastering",
];

export const STAGE_LABELS: Record<SubjectStage, string> = {
  not_started: "未开始",
  learning: "学习中",
  foundation: "基础完成",
  intensifying: "强化中",
  mastering: "冲刺/掌握",
};

/** 档位 → 默认 percent（档位是主输入，percent 只是显示/微调） */
export const STAGE_TO_PERCENT: Record<SubjectStage, number> = {
  not_started: 0,
  learning: 40,
  foundation: 70,
  intensifying: 85,
  mastering: 95,
};

export type SubjectConfidence = "low" | "medium" | "high";

/** 每科学习状态（additive 到 Goal.progress[科目]） */
export interface SubjectProgress {
  percent?: number;
  note?: string;
  /** 自评档位（"假设"） */
  stage?: SubjectStage;
  /** 是否已被对话校准（high = 已确认） */
  confidence?: SubjectConfidence;
  /** 对话校准后的档位（有则优先于自评） */
  calibratedStage?: SubjectStage;
  /** 上次探测时间 */
  lastProbeAt?: string;
}

/** 档位顺序索引 */
export function stageIndex(s: SubjectStage): number {
  return STAGE_ORDER.indexOf(s);
}

/** 老数据 percent → 推断档位（读时推断，写时让用户确认，不做静默迁移） */
export function inferStageFromPercent(percent: number | null | undefined): SubjectStage {
  if (percent == null) return "not_started";
  if (percent < 20) return "not_started";
  if (percent < 60) return "learning";
  if (percent < 80) return "foundation";
  if (percent < 95) return "intensifying";
  return "mastering";
}

/**
 * 有效档位 = 校准档位（若有）否则 自评档位（再否则按 percent 推断）。
 * 阶段推导、计划生成、显示都用它。
 */
export function getEffectiveStage(p: SubjectProgress): SubjectStage {
  if (p.calibratedStage) return p.calibratedStage;
  if (p.stage) return p.stage;
  return inferStageFromPercent(p.percent);
}

/** 基础是否完成（有效档位 >= 基础完成） */
export function isFoundationDone(p: SubjectProgress): boolean {
  return stageIndex(getEffectiveStage(p)) >= stageIndex("foundation");
}

/** 档位是否已确认（对话校准过 = high） */
export function isStageConfirmed(p: SubjectProgress): boolean {
  return p.confidence === "high";
}

/**
 * 是否需要确认（保守原则）：
 * - 已校准(high) → 不需要
 * - 未校准 + 有效档位已到"学习中"及以上 → 待确认（含接近满分的温和质疑）
 * - 未开始 → 天然确定，不需要
 */
export function needsConfirmation(p: SubjectProgress): boolean {
  if (isStageConfirmed(p)) return false;
  return stageIndex(getEffectiveStage(p)) >= stageIndex("learning");
}

// ── 科目感知完成标准（SUBJECT_COMPLETION_GUIDE）──

export interface CompletionGuideEntry {
  match: (subject: string) => boolean;
  /** "基础完成"的认知含义 */
  baseMeaning: string;
}

export const SUBJECT_COMPLETION_GUIDE: CompletionGuideEntry[] = [
  {
    match: (s) => s.includes("数学"),
    baseMeaning: "基础完成 ≈ 高数+线代+概率 教材 + 一轮基础习题过完",
  },
  {
    match: (s) => s.startsWith("英语"),
    baseMeaning: "核心词汇过完 + 语法系统学过（词汇贯穿全程）",
  },
  {
    match: (s) => s === "政治",
    baseMeaning: "强化课过一遍（政治通常 7 月后才启动）",
  },
  {
    match: (s) => s.includes("408"),
    baseMeaning: "指定教材 + 课后题过完一轮",
  },
  {
    match: (s) => s.startsWith("自主:"),
    baseMeaning: "章节过完 + AI 辅助评估",
  },
  { match: () => true, baseMeaning: "一轮系统学习过完，可进入强化" },
];

/** 取科目对应的"基础完成"认知标准 */
export function getSubjectGuide(subject: string): string {
  const hit = SUBJECT_COMPLETION_GUIDE.find((g) => g.match(subject));
  return hit?.baseMeaning ?? "一轮系统学习过完，可进入强化";
}

/** 完成度模型版本号（写入 progress 便于未来迁移判断） */
export const COMPLETION_MODEL_VERSION = 3;
