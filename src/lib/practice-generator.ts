/**
 * Shared practice question generator — used by both api/ai/generate-questions and api/practice
 */
import { prisma } from "@/lib/prisma";
import { getUserAiConfig } from "@/lib/ai-config";

export interface PracticeQuestion {
  id: string;
  type: "choice" | "essay";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  scoringPoints?: string[];
}

interface GenerateOptions {
  userId: string;
  type?: "daily" | "mock";
  subject: string;
  count?: number;
  materialIds?: string[];
  wrongQuestionIds?: string[];
}

export async function generatePracticeQuestions(
  opts: GenerateOptions
): Promise<PracticeQuestion[]> {
  const {
    userId,
    type = "daily",
    subject,
    count,
    materialIds,
    wrongQuestionIds,
  } = opts;

  const questionCount = count || (type === "mock" ? 20 : 5);
  const aiConfig = await getUserAiConfig(userId);

  // Build context: materials + wrong questions
  let contextStr = "";

  if (wrongQuestionIds?.length) {
    const wqs = await prisma.wrongQuestion.findMany({
      where: { id: { in: wrongQuestionIds }, userId },
      select: { question: true, answer: true, tags: true },
      take: 10,
    });
    if (wqs.length > 0) {
      contextStr += `\n## 用户的错题（出题时参考此类薄弱点）\n${wqs
        .map(
          (w) => `- ${w.question.slice(0, 100)} [标签: ${w.tags.join(", ")}]`
        )
        .join("\n")}`;
    }
  }

  if (materialIds?.length) {
    const mats = await prisma.material.findMany({
      where: { id: { in: materialIds }, userId },
      select: { name: true, content: true },
      take: 5,
    });
    const combined = mats
      .filter((m) => m.content)
      .map((m) => m.content!.slice(0, 2000))
      .join("\n\n");
    if (combined) {
      contextStr += `\n## 用户的学习资料（基于此内容出题）\n${combined.slice(0, 4000)}`;
    }
  }

  // Try AI
  if (aiConfig) {
    try {
      const modePrompt =
        type === "mock"
          ? "模拟真实考试，题目要有代表性，覆盖该科目的核心考点。难度分布：30%基础、50%中等、20%难题。选择题和简答题混合。"
          : "每日练习，题目简短精炼，侧重知识点的巩固和应用。2-3道选择题 + 1-2道简答题。";

      const response = await fetch(`${aiConfig.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            {
              role: "system",
              content:
                "你是考研命题专家。你只返回JSON，不返回其他内容。请根据要求生成练习题。",
            },
            {
              role: "user",
              content: `## 科目
${subject}

## 题目类型
${type === "mock" ? "模拟考试" : "每日练习"}

## 要求
1. 生成 ${questionCount} 道练习题
2. ${modePrompt}
3. 每道题必须包含：id（q0, q1...）、type（choice/essay）、question（题目）、correctAnswer（正确答案）、explanation（详细解析）
4. 选择题需包含 options（选项数组，如["A. ...", "B. ...", ...]）
5. 简答题需包含 scoringPoints（采分点数组）${contextStr}

## 输出格式（只返回JSON数组）
[{"id":"q0","type":"choice","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"B","explanation":"..."}]`,
            },
          ],
          temperature: 0.8,
          max_tokens: 8192,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as PracticeQuestion[];
          if (parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.error("AI generate-questions failed:", e);
    }
  }

  // Local fallback
  return generateLocalQuestions(subject, questionCount);
}

function generateLocalQuestions(
  subject: string,
  count: number
): PracticeQuestion[] {
  const templates: PracticeQuestion[] = [
    {
      id: "q0",
      type: "choice",
      question: `下列关于${subject}基本概念的描述中，正确的是哪一项？`,
      options: [
        "A. 概念理解需要从定义、性质、应用三个维度把握",
        "B. 只需要记住定义即可",
        "C. 概念之间没有关联性",
        "D. 以上都不对",
      ],
      correctAnswer: "A",
      explanation: `在${subject}中，概念理解需要从定义、性质、应用三个维度全面把握，而不是孤立地记忆。`,
    },
    {
      id: "q1",
      type: "essay",
      question: `请简述${subject}的核心知识框架，并说明各部分的逻辑关系。`,
      correctAnswer:
        "核心框架包括基础概念、核心理论、典型方法和综合应用四个层次，层层递进，由浅入深。",
      explanation: "建立知识框架有助于系统化学习，形成完整的认知结构。",
      scoringPoints: [
        "列出了核心组成部分（2分）",
        "说明了各部分的逻辑关系（2分）",
        "语言表达清晰（1分）",
      ],
    },
    {
      id: "q2",
      type: "choice",
      question: `在${subject}的复习过程中，最有效的学习方法是？`,
      options: [
        "A. 死记硬背所有知识点",
        "B. 理解概念+做题巩固+总结归纳",
        "C. 只看不练",
        "D. 考前突击",
      ],
      correctAnswer: "B",
      explanation:
        "理解概念、做题巩固、总结归纳是最有效的学习方法，能够形成完整的知识闭环。",
    },
    {
      id: "q3",
      type: "essay",
      question: `请列举${subject}中的常见题型，并简述每种题型的解题策略。`,
      correctAnswer:
        "常见题型包括基础概念题、计算应用题、综合分析题等，分别需要不同的解题策略。",
      explanation: "了解题型分类有助于针对性训练，提高应试能力。",
      scoringPoints: [
        "列举了常见题型（2分）",
        "说明了对应的解题策略（3分）",
      ],
    },
    {
      id: "q4",
      type: "choice",
      question: `关于${subject}的学习，以下哪种说法是错误的？`,
      options: [
        "A. 需要建立知识框架",
        "B. 做题是巩固知识的重要方式",
        "C. 不需要做任何练习",
        "D. 定期总结归纳很重要",
      ],
      correctAnswer: "C",
      explanation: "不做练习无法检验知识的掌握程度，练习是学习的重要环节。",
    },
  ];

  return Array.from({ length: Math.min(count, templates.length) }, (_, i) => ({
    ...templates[i],
    id: `q${i}`,
  }));
}
