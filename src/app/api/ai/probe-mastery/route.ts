import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson, extractJsonArray } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, type SubjectStage, type SubjectProgress } from "@/lib/completion";

/**
 * 对话式掌握度校准（完成度模型 v3 / docs/completion-model.md 0.2）
 *
 * 两步无状态调用：
 * 1. body 无 answers → 生成 2-3 个对话式问题（基于科目 + 自评档位 + 最近错题）
 * 2. body 带 answers → 评估回答 → { calibratedStage, evidence, suggestion, confirmed }
 *
 * 保守原则：回答含糊/错误 → 判低一档；只有准确且有深度才维持或高半档。
 */

interface ProbeBody {
  subject?: string;
  stage?: SubjectStage;
  note?: string;
  answers?: string;
}

const STAGE_SET = ["not_started", "learning", "foundation", "intensifying", "mastering"];

async function loadRecentWrong(userId: string, subject: string, take = 4): Promise<string[]> {
  try {
    const rows = await prisma.wrongQuestion.findMany({
      where: { userId, subject },
      orderBy: { updatedAt: "desc" },
      take,
      select: { question: true },
    });
    return rows.map((r) => r.question).filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const aiConfig = await getUserAiConfig(user!.id);
  if (!aiConfig) {
    return jsonNoStore(
      { error: "确认掌握度需要 AI，请先在设置页配置 AI Key" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ProbeBody;
    const subject = (body.subject || "").trim();
    if (!subject) return jsonNoStore({ error: "缺少科目" }, { status: 400 });

    const stage = (STAGE_SET.includes(body.stage || "") ? body.stage : "learning") as SubjectStage;
    const stageLabel = STAGE_LABELS[stage];
    const note = body.note?.trim();
    const wrong = await loadRecentWrong(user!.id, subject);

    // ── 第二步：评估回答 ──
    if (body.answers?.trim()) {
      const evalPrompt = `你是考研辅导老师。用户在学习「${subject}」，自评处于「${stageLabel}」阶段${note ? `，备注：${note}` : ""}。

用户对下面的提问做了回答，请判断他/她对「${subject}」${stageLabel}阶段内容的真实掌握程度。

提问与回答：
${body.answers.trim()}

保守原则：
- 回答含糊、答错、避重就轻、套话 → 判定比自评低一档（例如自评 foundation 答得差 → learning）
- 回答准确、有条理、能说清原理 → 维持自评档位，最多高半档（intensifying/mastering 只在有明显深度时给）
- confirmed = 校准结果是否"支持"自评（不是"用户厉害"，而是"校准后可以信任自评"）

只返回 JSON，不要返回其他内容：
{"calibratedStage":"learning|foundation|intensifying|mastering","evidence":"1-2句依据，具体到答对/答错的内容","suggestion":"1句可执行的建议","confirmed":true|false}`;

      const result = await callAI(aiConfig, {
        messages: [
          { role: "system", content: "你是严谨、温和的考研辅导老师，用保守但鼓励的方式评估学生。只返回 JSON。" },
          { role: "user", content: evalPrompt },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      });

      const parsed = extractJson<{
        calibratedStage: string;
        evidence: string;
        suggestion: string;
        confirmed: boolean;
      }>(result.text || "");
      if (!parsed || !STAGE_SET.includes(parsed.calibratedStage || "")) {
        return jsonNoStore({ error: "评估结果格式不正确，请重试" }, { status: 500 });
      }

      return jsonNoStore({
        calibratedStage: parsed.calibratedStage as SubjectStage,
        evidence: parsed.evidence || "",
        suggestion: parsed.suggestion || "",
        confirmed: Boolean(parsed.confirmed),
      });
    }

    // ── 第一步：生成问题 ──
    const wrongContext =
      wrong.length > 0 ? `\n他/她的最近错题（用来挑选最值得确认的知识点）：\n- ${wrong.join("\n- ")}` : "";
    const genPrompt = `你是考研辅导老师。用户正在学习「${subject}」，自评处于「${stageLabel}」阶段${note ? `，备注：${note}` : ""}。

为了保守地确认他/她的掌握度（自评可能偏高，不要轻易相信），请出 3 个对话式问题：
1. 覆盖「${subject}」${stageLabel}阶段最核心的知识点/方法
2. 从浅到深（第 3 个要能逼出"是否真懂原理"）
3. 是老师提问的对话形式，不是选择题试卷
4. 问题要具体到知识点（如"求导的链式法则在什么条件下成立、为什么"），不要泛泛问"你学得怎么样"
${wrongContext}

只返回 JSON 数组（3 个字符串），不要返回其他内容。`;

    const result = await callAI(aiConfig, {
      messages: [
        { role: "system", content: "你是严谨的考研辅导老师，出能检验真理解的问题。只返回 JSON 数组。" },
        { role: "user", content: genPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1024,
    });

    const parsedQuestions = extractJsonArray<string>(result.text || "");
    const questions = (parsedQuestions ?? []).filter((q) => typeof q === "string");
    if (questions.length === 0) {
      return jsonNoStore({ error: "问题生成失败，请重试" }, { status: 500 });
    }

    return jsonNoStore({ questions: questions.slice(0, 3) });
  } catch (err) {
    return handleApiError(err, "确认掌握度");
  }
}
