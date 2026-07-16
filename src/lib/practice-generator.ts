/**
 * Shared practice question generator — used by both api/ai/generate-questions and api/practice
 */
import { prisma } from "@/lib/prisma";
import { getUserAiConfig } from "@/lib/ai-config";
import { searchMaterials, findRelevantSegments } from "@/lib/rag";

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

  // Build context: wrong questions + materials via semantic search
  let contextStr = "";

  // Wrong questions context
  if (wrongQuestionIds?.length) {
    const wqs = await prisma.wrongQuestion.findMany({
      where: { id: { in: wrongQuestionIds }, userId },
      select: { question: true, answer: true, tags: true },
      take: 10,
    });
    if (wqs.length > 0) {
      contextStr += `\n## 用户的错题（出题时重点考察此类薄弱知识点）\n${wqs
        .map(
          (w) => `- ${w.question.slice(0, 200)} [标签: ${w.tags.join(", ")}]`
        )
        .join("\n")}`;
    }
  }

  // Materials context via semantic search (replaces naive truncation)
  try {
    const userMaterials = await prisma.material.findMany({
      where: {
        userId,
        content: { not: null },
        ...(materialIds?.length ? { id: { in: materialIds } } : {}),
      },
      select: { id: true, name: true, content: true },
    });

    if (userMaterials.length > 0) {
      // Use subject as query for semantic search (same pipeline as chat RAG)
      const searchResults = await searchMaterials(
        subject,
        userMaterials,
        userId
      );

      if (searchResults.length > 0) {
        const ragCtx = searchResults
          .map((r, i) => {
            const segments = findRelevantSegments(subject, r.content, 3);
            const scorePct = Math.round(r.score * 100);
            return `[资料${i + 1}: ${r.name}（相关度 ${scorePct}%）]\n${segments.join("\n\n")}`;
          })
          .join("\n\n---\n\n");

        contextStr += `\n## 用户的学习资料（基于以下资料内容出题，紧扣知识点）\n${ragCtx.slice(0, 8000)}`;
      } else if (materialIds?.length) {
        // Fallback: if user explicitly selected materials but no semantic match, use them directly
        const combined = userMaterials
          .filter((m) => m.content)
          .map((m) => m.content!.slice(0, 3000))
          .join("\n\n");
        if (combined) {
          contextStr += `\n## 用户的学习资料（基于此内容出题）\n${combined.slice(0, 6000)}`;
        }
      }
    }
  } catch (e) {
    console.error("Material search for question generation failed:", e);
    // Non-blocking: continue without material context
  }

  // Try AI
  if (aiConfig) {
    try {
      const modePrompt =
        type === "mock"
          ? "模拟真实考试，题目要有代表性，覆盖该科目的核心考点。难度分布：30%基础、50%中等、20%难题。选择题和简答题混合。如果提供了学习资料，必须基于资料内容出题，考察对资料知识的理解和应用。"
          : "每日练习，题目简短精炼，侧重知识点的巩固和应用。2-3道选择题 + 1-2道简答题。如果提供了学习资料，必须基于资料内容出题。";

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
                "你是考研命题专家。你只返回JSON，不返回其他内容。请根据要求生成练习题。如果有学习资料，必须基于资料内容出题，不要脱离资料编造。",
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
          max_tokens: 16384,
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

// ── Expanded local templates (5 → 20+ across 5 categories) ──

type QuestionCategory = "concept" | "application" | "analysis" | "comparison" | "synthesis";

const templates: Record<QuestionCategory, Omit<PracticeQuestion, "id">[]> = {
  // 概念辨析 — 选择题 (6)
  concept: [
    {
      type: "choice",
      question: `下列关于${"{subject}"}核心概念的描述中，正确的是哪一项？`,
      options: ["A. 概念理解应把握定义、性质、应用三个维度", "B. 只需要记住概念定义即可", "C. 概念之间没有内在关联", "D. 以上说法都不对"],
      correctAnswer: "A",
      explanation: `在${"{subject}"}中，概念理解需要从定义、性质、应用三个维度全面把握。`,
    },
    {
      type: "choice",
      question: `在${"{subject}"}中，以下哪项不属于基础理论体系的组成部分？`,
      options: ["A. 核心定义与公理", "B. 基本定理与推论", "C. 典型方法与技巧", "D. 所有上述都属于"],
      correctAnswer: "D",
      explanation: `基础理论体系包含核心定义、基本定理和典型方法，三者缺一不可。`,
    },
    {
      type: "choice",
      question: `${"{subject}"}中经常出现的一个误区是？`,
      options: ["A. 混淆相似概念", "B. 忽视前提条件", "C. 片面理解定义", "D. 以上都是常见误区"],
      correctAnswer: "D",
      explanation: `概念混淆、忽视前提和片面理解都是${"{subject}"}学习中的高频错误。`,
    },
    {
      type: "choice",
      question: `关于${"{subject}"}的知识体系，下列哪种描述最准确？`,
      options: ["A. 知识体系是线性的，按章节顺序学习即可", "B. 知识体系呈网状结构，各知识点相互关联", "C. 知识体系是树形的，从根节点逐步展开", "D. 知识体系没有固定结构"],
      correctAnswer: "B",
      explanation: `知识体系呈网状结构，理解知识点间的关联比孤立记忆更重要。`,
    },
    {
      type: "choice",
      question: `在${"{subject}"}中，"理解"与"记忆"的关系是？`,
      options: ["A. 先记忆后理解", "B. 先理解后记忆，理解促进记忆", "C. 两者独立，互不影响", "D. 只需要理解不需要记忆"],
      correctAnswer: "B",
      explanation: `理解后的记忆更持久、更灵活，理解是记忆的基础。`,
    },
    {
      type: "choice",
      question: `以下哪种方式最能有效巩固${"{subject}"}的基础概念？`,
      options: ["A. 反复抄写定义", "B. 用自己的话解释 + 举例说明 + 做题验证", "C. 只看教材即可", "D. 背诵标准答案"],
      correctAnswer: "B",
      explanation: `"解释+举例+做题"三步法能多角度巩固概念，形成深层理解。`,
    },
  ],

  // 计算/应用 — 选择题 (4)
  application: [
    {
      type: "choice",
      question: `运用${"{subject}"}的知识分析以下情境，最合理的方案是？`,
      options: ["A. 直接套用公式求解", "B. 先分析已知条件，再选择合适方法", "C. 尝试所有可能的方法", "D. 跳过不确定的步骤"],
      correctAnswer: "B",
      explanation: `分析已知条件是解题的首要步骤，在此基础上选择合适方法才能高效解题。`,
    },
    {
      type: "choice",
      question: `在${"{subject}"}的典型考题中，最常见的设问角度是？`,
      options: ["A. 直接考查定义记忆", "B. 结合多个知识点综合考查", "C. 单个知识点的简单应用", "D. 纯计算题"],
      correctAnswer: "B",
      explanation: `考研题目通常综合多个知识点，考查知识迁移和综合运用能力。`,
    },
    {
      type: "choice",
      question: `${"{subject}"}解题时，遇到陌生题型应该？`,
      options: ["A. 放弃不做", "B. 回归基础概念，分析题目本质", "C. 猜一个答案", "D. 照搬相似题的解法"],
      correctAnswer: "B",
      explanation: `回归基础概念、分析题目本质是应对陌生题型的最有效策略。`,
    },
    {
      type: "choice",
      question: `在${"{subject}"}的复习中，以下哪种做题策略最有效？`,
      options: ["A. 只做真题，不做模拟题", "B. 先分类精练，再综合训练，最后限时模考", "C. 大量刷题不求甚解", "D. 只看不做"],
      correctAnswer: "B",
      explanation: `"分类→综合→模考"三步走策略循序渐进，效果最佳。`,
    },
  ],

  // 理解分析 — 简答题 (5)
  analysis: [
    {
      type: "essay",
      question: `请简述${"{subject}"}的核心知识框架，并说明各部分之间的逻辑关系。`,
      correctAnswer: `核心框架包括基础概念层、核心理论层、典型方法层和综合应用层，各层之间层层递进、相互支撑。`,
      explanation: `建立知识框架有助于系统化学习，形成完整的认知结构。`,
      scoringPoints: ["列出核心组成部分（2分）", "说明各部分的逻辑关系（2分）", "语言表达清晰有条理（1分）"],
    },
    {
      type: "essay",
      question: `${"{subject}"}中常见的易错点有哪些？请分类说明并给出避免方法。`,
      correctAnswer: `常见易错点分为三类：概念混淆类、计算粗心类、逻辑跳跃类。分别需要加强概念辨析、规范解题步骤、完善推理过程。`,
      explanation: `识别和归类易错点有助于针对性改进，提升答题准确率。`,
      scoringPoints: ["列举了至少两类易错点（2分）", "给出了具体的避免方法（2分）", "结合实例说明（1分）"],
    },
    {
      type: "essay",
      question: `请分析${"{subject}"}中一道典型题目的解题思路，并总结该类题目的通用解法。`,
      correctAnswer: `典型解题思路：审题→提取关键信息→确定知识范围→选择方法→分步求解→验证。通用解法需结合具体题型归纳。`,
      explanation: `掌握通用解法可以举一反三，提高解题效率。`,
      scoringPoints: ["完整呈现解题步骤（2分）", "总结出通用方法（2分）", "逻辑清晰（1分）"],
    },
    {
      type: "essay",
      question: `在学习${"{subject}"}的过程中，如何建立知识之间的联系？请举例说明。`,
      correctAnswer: `可以通过绘制思维导图、制作对比表格、归纳共性规律等方式建立联系。例如将相关概念放在同一框架下对比分析。`,
      explanation: `知识之间的联系是深层理解的体现，也是灵活运用的基础。`,
      scoringPoints: ["提出了至少两种建立联系的方法（2分）", "给出了具体例子（2分）", "表述完整（1分）"],
    },
    {
      type: "essay",
      question: `请解释${"{subject}"}中基础知识与高阶应用之间的关系，并给出学习建议。`,
      correctAnswer: `基础知识是地基，高阶应用是建筑物。没有扎实的基础，高阶应用无从谈起；只有基础知识而不会应用，也无法应对考试。`,
      explanation: `基础与应用是相辅相成的关系，建议在学习中交替进行。`,
      scoringPoints: ["阐述了基础与应用的关系（2分）", "给出了具体学习建议（2分）", "论述有深度（1分）"],
    },
  ],

  // 对比归纳 — 简答题 (3)
  comparison: [
    {
      type: "essay",
      question: `请比较${"{subject}"}中相关概念的异同点，并说明区分它们的关键依据。`,
      correctAnswer: `从定义、适用范围、典型特征等维度进行对比分析。区分的关键在于抓住各自的核心特征和适用边界。`,
      explanation: `对比分析是深化概念理解的有效方法，也是考试中的常见题型。`,
      scoringPoints: ["指明了相同点（1分）", "指明了不同点（2分）", "给出了区分依据（2分）"],
    },
    {
      type: "essay",
      question: `${"{subject}"}中有哪些常见的题类？分别简述其特点和应对策略。`,
      correctAnswer: `常见题类包括基础概念题、计算应用题、综合分析题、证明推导题等。各有不同的考查重点和应对方法。`,
      explanation: `熟悉题型分类有助于针对性地准备和应对。`,
      scoringPoints: ["列举了至少 3 种题型（2分）", "说明了各自特点（2分）", "给出了应对策略（1分）"],
    },
    {
      type: "essay",
      question: `在${"{subject}"}的学习中，不同章节之间存在哪些横向联系？请举例说明。`,
      correctAnswer: `不同章节之间通过核心概念、方法论、应用场景等建立横向联系。例如前面章节的方法可以用于解决后面章节的问题。`,
      explanation: `发现章节间的横向联系有助于构建完整的知识网络。`,
      scoringPoints: ["指出了至少两组横向联系（2分）", "给出了具体例子（2分）", "表述清晰（1分）"],
    },
  ],

  // 综合论述 — 简答题 (2)
  synthesis: [
    {
      type: "essay",
      question: `综合运用${"{subject}"}的知识，分析一个实际问题的解决思路，并说明每一步的依据。`,
      correctAnswer: `分析思路：明确问题→分解为子问题→匹配知识模块→选择解决方法→逐一求解→整合结果→验证。每一步都需有理论依据。`,
      explanation: `综合题考查知识整合能力和实际问题解决能力，是考研的重点和难点。`,
      scoringPoints: ["问题分析合理（1分）", "解题步骤完整（2分）", "每步有依据说明（1分）", "逻辑连贯（1分）"],
    },
    {
      type: "essay",
      question: `请设计一个${"{subject}"}的复习计划大纲，说明每个阶段的重点和方法。`,
      correctAnswer: `复习分三个阶段：基础阶段（全面学习，建立框架）、强化阶段（重点突破，大量练习）、冲刺阶段（模拟实战，查漏补缺）。`,
      explanation: `科学的复习计划能提高效率、减少盲目性。`,
      scoringPoints: ["划分了清晰的阶段（2分）", "每个阶段有明确重点（2分）", "方法具体可行（1分）"],
    },
  ],
};

// Category ratio for question distribution
const categoryRatio: { cat: QuestionCategory; ratio: number }[] = [
  { cat: "concept", ratio: 0.30 },
  { cat: "application", ratio: 0.20 },
  { cat: "analysis", ratio: 0.25 },
  { cat: "comparison", ratio: 0.15 },
  { cat: "synthesis", ratio: 0.10 },
];

function generateLocalQuestions(
  subject: string,
  count: number
): PracticeQuestion[] {
  // Distribute count across categories by ratio
  const pool: PracticeQuestion[] = [];
  const usedInCategory: Record<string, Set<number>> = {};

  let remaining = count;
  for (let ri = 0; ri < categoryRatio.length && remaining > 0; ri++) {
    const { cat, ratio } = categoryRatio[ri];
    const isLast = ri === categoryRatio.length - 1;
    const catCount = isLast ? remaining : Math.max(1, Math.round(count * ratio));
    const actual = Math.min(catCount, remaining);
    remaining -= actual;

    const catTemplates = templates[cat];
    if (!usedInCategory[cat]) usedInCategory[cat] = new Set();

    for (let i = 0; i < actual; i++) {
      // Pick a random unused template from this category
      const available = catTemplates
        .map((_, idx) => idx)
        .filter((idx) => !usedInCategory[cat].has(idx));

      if (available.length === 0) {
        usedInCategory[cat].clear(); // reset if all used
        available.push(...catTemplates.map((_, idx) => idx));
      }

      const pick = available[Math.floor(Math.random() * available.length)];
      usedInCategory[cat].add(pick);

      pool.push({
        id: `q${pool.length}`,
        ...catTemplates[pick],
        question: catTemplates[pick].question.replace(/\{subject\}/g, subject),
        explanation: catTemplates[pick].explanation.replace(/\{subject\}/g, subject),
        correctAnswer: catTemplates[pick].correctAnswer.replace(/\{subject\}/g, subject),
        ...(catTemplates[pick].type === "choice"
          ? { options: catTemplates[pick].options!.map((o) => o.replace(/\{subject\}/g, subject)) }
          : {}),
        ...(catTemplates[pick].type === "essay"
          ? { scoringPoints: catTemplates[pick].scoringPoints!.map((p) => p.replace(/\{subject\}/g, subject)) }
          : {}),
      });
    }
  }

  return pool;
}
