import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { wrongQuestionId, count = 3 } = body;

    if (!wrongQuestionId) {
      return NextResponse.json({ error: "请指定错题ID" }, { status: 400 });
    }

    const wq = await prisma.wrongQuestion.findUnique({
      where: { id: wrongQuestionId },
    });

    if (!wq || wq.userId !== user!.id) {
      return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    }

    const aiConfig = await getUserAiConfig(user!.id);
    let questions: { question: string; answer: string; explanation: string }[] =
      [];

    if (aiConfig) {
      try {
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
                  "你是考研辅导专家。你只返回JSON，不返回其他内容。请根据用户提供的错题，生成类似但不同的练习题，帮助学生巩固知识点。",
              },
              {
                role: "user",
                content: `## 原始错题
科目：${wq.subject}
题目：${wq.question}
答案/解析：${wq.answer}
标签：${wq.tags.join("、")}

## 要求
1. 生成 ${count} 道类似但不相同的练习题
2. 难度应与原题相当
3. 每道题包含：question（题目）、answer（答案）、explanation（详细解析）
4. 题目应考察相同的知识点但换不同的问法和角度

## 输出格式（只返回JSON数组）
[{"question": "...", "answer": "...", "explanation": "..."}]`,
              },
            ],
            temperature: 0.8,
            max_tokens: 4096,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.error("AI generate-similar failed:", e);
      }
    }

    // Local fallback
    if (questions.length === 0) {
      questions = generateLocalSimilar(wq.subject, wq.question, wq.answer, count);
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Generate similar error:", err);
    return NextResponse.json({ error: "生成练习题失败" }, { status: 500 });
  }
}

function generateLocalSimilar(
  subject: string,
  originalQuestion: string,
  _originalAnswer: string,
  count: number
): { question: string; answer: string; explanation: string }[] {
  const templates = [
    {
      question: `请从不同角度分析"${originalQuestion.slice(0, 30)}..."相关知识点的应用。`,
      answer: `结合${subject}的核心概念，从理论与实践两个层面进行阐述。`,
      explanation: `本题考察${subject}的基础知识，建议回顾相关章节的核心概念和典型例题。`,
    },
    {
      question: `关于"${originalQuestion.slice(0, 30)}..."相关考点，请列举常见的解题思路和易错点。`,
      answer: `常见的解题思路包括：1) 分析题目条件 2) 确定适用的理论 3) 分步骤推导。易错点主要在概念混淆和计算粗心。`,
      explanation: `通过归纳常见解题思路，帮助学生建立系统的解题框架。`,
    },
    {
      question: `请简述${subject}中与"${originalQuestion.slice(0, 20)}..."相关的核心概念，并举例说明。`,
      answer: `核心概念需要从定义、性质、应用三个维度理解。举例应选择典型且具有代表性的场景。`,
      explanation: `概念理解是解题的基础，通过举例将抽象概念具体化。`,
    },
  ];

  return Array.from({ length: count }, (_, i) => ({
    ...templates[i % templates.length],
  }));
}
