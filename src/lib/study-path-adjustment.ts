export interface StageAdjustmentAddition {
  subject: string;
  topic: string;
  title: string;
  description: string;
  exitCriterion: string;
}

export interface ParsedStageAdjustment {
  scope: "weekly" | "stage" | "unclear";
  additions: StageAdjustmentAddition[];
}

const TOPIC_RULES: Array<{ pattern: RegExp; topic: string; subjectHint: RegExp }> = [
  { pattern: /计算机网络|网络原理|计网/, topic: "计算机网络", subjectHint: /408|计算机/ },
  { pattern: /数据结构/, topic: "数据结构", subjectHint: /408|计算机/ },
  { pattern: /操作系统/, topic: "操作系统", subjectHint: /408|计算机/ },
  { pattern: /组成原理|计算机组成/, topic: "计算机组成原理", subjectHint: /408|计算机/ },
  { pattern: /高数|微积分|线代|概率|数学/, topic: "数学基础", subjectHint: /数学/ },
  { pattern: /阅读|词汇|英语/, topic: "英语基础", subjectHint: /英语/ },
  { pattern: /政治/, topic: "政治基础", subjectHint: /政治/ },
];

export function parseStageAdjustment(request: string, subjects: string[]): ParsedStageAdjustment {
  const text = request.trim();
  if (!text) return { scope: "unclear", additions: [] };
  if (/(今天|本周|这周|这几天|周[一二三四五六日天]|\d+(?:\.\d+)?\s*(?:个)?小时)/.test(text)) {
    return { scope: "weekly", additions: [] };
  }

  const additions: StageAdjustmentAddition[] = [];
  for (const rule of TOPIC_RULES) {
    if (!rule.pattern.test(text)) continue;
    const subject = subjects.find((item) => rule.subjectHint.test(item));
    if (!subject) continue;
    additions.push({
      subject,
      topic: rule.topic,
      title: `补齐${rule.topic}基础`,
      description: `根据阶段调整要求“${text}”，完成${rule.topic}的课程/教材学习、基础练习和一次掌握度检查。`,
      exitCriterion: `${rule.topic}完成第一轮基础学习，并通过练习或对话确认达到“基础已建立”`,
    });
  }

  return { scope: additions.length > 0 ? "stage" : "unclear", additions };
}
