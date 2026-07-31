import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { searchMaterials, findRelevantSegments } from "@/lib/rag";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { wrongQuestionId, count = 3 } = body;

    if (!wrongQuestionId) {
      return jsonNoStore({ error: "请指定错题ID" }, { status: 400 });
    }

    const wq = await prisma.wrongQuestion.findUnique({
      where: { id: wrongQuestionId },
    });

    if (!wq || wq.userId !== user!.id) {
      return jsonNoStore({ error: "错题不存在" }, { status: 404 });
    }

    const aiConfig = await getUserAiConfig(user!.id);
    let questions: { question: string; answer: string; explanation: string }[] =
      [];

    // Build material context for this wrong question's subject/tags
    let materialCtx = "";
    try {
      const queryText = `${wq.subject} ${wq.tags.join(" ")} ${wq.question.slice(0, 100)}`;
      const userMaterials = await prisma.material.findMany({
        where: { userId: user!.id, content: { not: null } },
        select: { id: true, name: true, content: true },
      });

      if (userMaterials.length > 0) {
        const searchResults = await searchMaterials(
          queryText,
          userMaterials,
          user!.id
        );
        if (searchResults.length > 0) {
          const segments = searchResults
            .slice(0, 3)
            .map((r) => {
              const relevant = findRelevantSegments(queryText, r.content, 2);
              return `[资料: ${r.name}]\n${relevant.join("\n\n")}`;
            })
            .join("\n\n---\n\n");
          materialCtx = `\n## 参考资料（出题时可参考以下内容）\n${segments.slice(0, 4000)}`;
        }
      }
    } catch {
      // Non-blocking
    }

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
                  "你是考研辅导专家。你只返回JSON，不返回其他内容。请根据用户提供的错题，生成类似但不同的练习题，帮助学生巩固知识点。如果有参考资料，请基于资料内容出题。",
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
4. 题目应考察相同的知识点但换不同的问法和角度${materialCtx}

## 输出格式（只返回JSON数组）
[{"question": "...", "answer": "...", "explanation": "..."}]`,
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

    return jsonNoStore({ questions });
  } catch (err) {
    console.error("Generate similar error:", err);
    return jsonNoStore({ error: "生成练习题失败" }, { status: 500 });
  }
}

function generateLocalSimilar(
  subject: string,
  originalQuestion: string,
  originalAnswer: string,
  count: number
): { question: string; answer: string; explanation: string }[] {
  const snippet = originalQuestion.slice(0, 40);
  const keyPoint = originalAnswer.slice(0, 60);

  const templates = [
    {
      question: `请从不同角度分析"${snippet}..."相关知识点的应用场景和注意事项。`,
      answer: `结合${subject}的核心概念，从理论与实践两个层面进行阐述。关键要点：${keyPoint}...`,
      explanation: `本题考察${subject}的基础知识应用，建议回顾相关章节的核心概念和典型例题。`,
    },
    {
      question: `关于"${snippet}..."相关考点，请列举常见的解题思路和易错点。`,
      answer: `常见解题思路：1) 审题分析条件 2) 确定适用的理论/公式 3) 分步骤推导 4) 验证结果。易错点主要在概念混淆和步骤遗漏。`,
      explanation: `通过归纳常见解题思路，帮助学生建立系统的解题框架，减少重复错误。`,
    },
    {
      question: `请简述${subject}中与"${snippet}..."相关的核心概念，并举例说明其实际应用。`,
      answer: `核心概念需从定义、性质、应用三个维度理解。举例应选择典型且具有代表性的场景，说明该概念如何解决实际问题。`,
      explanation: `概念理解是解题的基础，通过举例将抽象概念具体化，加深记忆和理解。`,
    },
    {
      question: `在${subject}的学习中，"${snippet}..."这个知识点常与其他哪些知识点联合考查？请举例说明。`,
      answer: `该知识点常与相关理论、计算方法等联合考查。例如在同一道题中可能先考查概念理解，再要求运用公式计算，最后综合分析得出结论。`,
      explanation: `了解知识点的关联关系有助于应对综合性题目，避免"只见树木不见森林"。`,
    },
    {
      question: `请设计一道与"${snippet}..."相关的新题目，并给出详细的解答过程。`,
      answer: `新题目应换一个设问角度或应用场景，但核心知识点不变。解答过程包含：审题分析 → 知识定位 → 分步求解 → 总结验证。`,
      explanation: `自己设计题目是深度学习的有效方法，需要真正理解知识点才能出好题。`,
    },
  ];

  return Array.from({ length: count }, (_, i) => ({
    ...templates[i % templates.length],
  }));
}
