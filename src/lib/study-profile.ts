import type { EvidenceConfidence, ProfileFactSource } from "@/lib/planning-types";

export interface StudyProfileGoalContext {
  examDate?: string | Date | null;
  examYear?: number | null;
  university?: string | null;
  major?: string | null;
  subjects?: string[] | null;
  weeklyHours?: number | null;
}

export interface StudyProfileFactDraft {
  key: string;
  label: string;
  value: Record<string, unknown>;
  source: ProfileFactSource;
  confidence: EvidenceConfidence;
}

export interface PlanningIntakeAnalysis {
  summary: string;
  facts: StudyProfileFactDraft[];
  questions: PlanningInterviewQuestion[];
  unresolvedFields: string[];
}

export type PlanningInterviewQuestionKind = "text" | "number" | "choice";

export interface PlanningInterviewQuestion {
  key: string;
  label: string;
  help: string;
  kind: PlanningInterviewQuestionKind;
  options?: string[];
}

export type PlanningInterviewAnswers = Record<string, string>;

const INTERVIEW_FACT_META: Record<string, { label: string; key: string }> = {
  exam_time: { label: "预计考试时间", key: "planning.exam_time" },
  weekly_capacity: { label: "每周稳定学习容量", key: "planning.weekly_capacity" },
  school_strategy: { label: "院校未定时的行动策略", key: "planning.school_strategy" },
  exam_subjects: { label: "已知考试科目与待定分支", key: "planning.exam_subjects" },
  subject_baseline: { label: "各科当前基础描述", key: "planning.subject_baseline" },
  foundation_exit: { label: "基础阶段退出标准", key: "planning.foundation_exit" },
};

const NOT_LEARNED = /(没学|未学|还没学|没有学|尚未学|没开始)/;

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function subjectStatusFact(
  text: string,
  subject: string,
  aliases: string[],
): StudyProfileFactDraft | null {
  const names = [subject, ...aliases];
  const mentioned = includesAny(text, names);
  if (!mentioned) return null;
  const relevantText = text
    .split(/[，。；;,\n]/)
    .filter((clause) => includesAny(clause, names))
    .join(" ");
  if (NOT_LEARNED.test(relevantText)) {
    return {
      key: `subject.${subject}.foundation_status`,
      label: `${subject}尚未开始`,
      value: { subject, state: "not_started", detail: "用户明确表示尚未学习" },
      source: "user_statement",
      confidence: "high",
    };
  }
  if (/(基础.{0,2}弱|基础薄弱|比较弱|较弱|不好|薄弱)/.test(relevantText)) {
    return {
      key: `subject.${subject}.foundation_status`,
      label: `${subject}基础薄弱`,
      value: { subject, state: "weak", detail: "用户自评基础薄弱" },
      source: "self_assessment",
      confidence: "medium",
    };
  }
  return null;
}

/**
 * 无 AI Key 也可工作的保守分析器。只提取用户明确说出的高价值事实，
 * 无法确认的内容保留为问题，不把关键词猜测伪装成事实。
 */
export function analyzePlanningStatement(
  rawStatement: string,
  goal: StudyProfileGoalContext = {},
): PlanningIntakeAnalysis {
  const statement = rawStatement.trim();
  const facts: StudyProfileFactDraft[] = [];

  if (statement) {
    facts.push({
      key: "planning.statement",
      label: "你的规划原话",
      value: { text: statement },
      source: "user_statement",
      confidence: "high",
    });
  }

  const candidates: Array<[string, string[]]> = [
    ["计算机网络", ["计网"]],
    ["数学", ["数学一", "数学二", "高数"]],
    ["英语", ["英语一", "英语二"]],
    ["数据结构", []],
    ["操作系统", []],
    ["计算机组成原理", ["计组"]],
    ["政治", []],
  ];
  for (const [subject, aliases] of candidates) {
    const fact = subjectStatusFact(statement, subject, aliases);
    if (fact && !facts.some((item) => item.key === fact.key)) facts.push(fact);
  }

  if (/四级/.test(statement) && /(过了|通过|已过)/.test(statement)) {
    facts.push({
      key: "english.cet4",
      label: "英语四级已通过",
      value: { exam: "CET-4", state: "passed" },
      source: "user_statement",
      confidence: "high",
    });
  }
  if (/六级/.test(statement) && /(没过|未过|没有过|未通过)/.test(statement)) {
    facts.push({
      key: "english.cet6",
      label: "英语六级尚未通过",
      value: { exam: "CET-6", state: "not_passed" },
      source: "user_statement",
      confidence: "high",
    });
  }
  if (/(补(一遍|全|齐)?.*(所有|全部|全科).*(基础)|所有课程.*基础|全科.*基础)/.test(statement)) {
    facts.push({
      key: "planning.strategy",
      label: "未完成课程与全科基础并行",
      value: { mode: "parallel_foundation", detail: "学习未完成内容的同时补齐全部课程基础" },
      source: "user_statement",
      confidence: "high",
    });
  }

  const questions: PlanningInterviewQuestion[] = [];
  const unresolvedFields: string[] = [];
  if (!goal.examDate && !goal.examYear) {
    unresolvedFields.push("exam_time");
    questions.push({ key: "exam_time", label: "你预计参加哪一年的考试？", help: "暂时不知道也可以，路线会先按探索期设计。", kind: "text" });
  }
  if (!goal.weeklyHours) {
    unresolvedFields.push("weekly_capacity");
    questions.push({ key: "weekly_capacity", label: "每周能稳定投入多少小时？", help: "还在上课、实习等固定占用也请算进去。", kind: "number" });
  }
  if (!goal.university) {
    unresolvedFields.push("target_school");
    questions.push({
      key: "school_strategy",
      label: "院校还未确定时，这段时间先怎么安排？",
      help: "这个选择可以随时调整，不会锁死院校方向。",
      kind: "choice",
      options: ["先做择校调研", "先补统考公共基础", "两件事并行"],
    });
  }
  if (!goal.subjects?.length) {
    unresolvedFields.push("exam_subjects");
    questions.push({ key: "exam_subjects", label: "哪些科目确定要学，哪些仍取决于院校选择？", help: "可直接写“数学、英语确定，专业课待择校后确认”。", kind: "text" });
  }
  if (!facts.some((fact) => fact.key.startsWith("subject."))) {
    unresolvedFields.push("subject_baseline");
    questions.push({ key: "subject_baseline", label: "目前各科分别学到哪里？", help: "不确定时可以先写大概，之后通过小范围自检校准。", kind: "text" });
  }
  questions.push({
    key: "foundation_exit",
    label: "第一轮基础结束时，你希望达到什么程度？",
    help: "这会成为基础阶段的退出标准，可在路线草稿里继续修改。",
    kind: "choice",
    options: ["跟完课程并整理知识框架", "完成基础题并订正", "能独立完成典型题"],
  });

  const extracted = facts.filter((fact) => fact.key !== "planning.statement").map((fact) => fact.label);
  return {
    summary: extracted.length > 0
      ? `目前先按“${extracted.join("、")}”理解你的情况。确认前不会用于重排正式计划。`
      : "已保留你的原始描述，但还没有足够信息形成可靠判断。确认前不会用于重排正式计划。",
    facts,
    questions,
    unresolvedFields,
  };
}

export function buildInterviewFacts(answers: PlanningInterviewAnswers): StudyProfileFactDraft[] {
  const facts: StudyProfileFactDraft[] = [];
  for (const [questionKey, rawAnswer] of Object.entries(answers)) {
    const answer = rawAnswer.trim();
    const meta = INTERVIEW_FACT_META[questionKey];
    if (!meta || !answer) continue;
    const unknown = answer === "__unknown__";
    facts.push({
      key: meta.key,
      label: unknown ? meta.label + "暂不确定" : meta.label,
      value: unknown ? { state: "unknown" } : { answer },
      source: "user_statement",
      confidence: unknown ? "low" : "high",
    });
  }
  return facts;
}

export function formatStudyProfileFactsForPrompt(
  facts: Array<{ label: string; value: unknown; source: string; confidence: string }>,
): string {
  if (facts.length === 0) return "- 尚无已确认的学习档案事实";
  return facts.map((fact) => `- ${fact.label}（来源：${fact.source}，可信度：${fact.confidence}）：${JSON.stringify(fact.value)}`).join("\n");
}
