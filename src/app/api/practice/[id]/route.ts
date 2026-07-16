import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const session = await prisma.practiceSession.findUnique({
      where: { id },
    });

    if (!session || session.userId !== user!.id) {
      return NextResponse.json({ error: "练习不存在" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error("Get practice session error:", err);
    return NextResponse.json({ error: "获取练习详情失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const session = await prisma.practiceSession.findUnique({
      where: { id },
    });

    if (!session || session.userId !== user!.id) {
      return NextResponse.json({ error: "练习不存在" }, { status: 404 });
    }

    const body = await request.json();

    // Status change (abandon / start)
    if (body.status && !body.answers) {
      const updated = await prisma.practiceSession.update({
        where: { id },
        data: {
          status: body.status,
          ...(body.startedAt ? { startedAt: new Date(body.startedAt) } : {}),
        },
      });
      return NextResponse.json({ session: updated });
    }

    // Answer submission — grade and score
    if (body.answers) {
      const questions = session.questions as Array<{
        id: string;
        type: string;
        question: string;
        options?: string[];
        correctAnswer: string;
        explanation: string;
        scoringPoints?: string[];
      }>;

      const answers = body.answers as Record<string, string>;
      const scores: Record<
        string,
        { score: number; maxScore: number; feedback: string }
      > = {};
      let totalScore = 0;
      const maxPerQ = 10;
      const maxScore = questions.length * maxPerQ;

      // Auto-grade choice questions
      const essayQuestions: {
        id: string;
        question: string;
        userAnswer: string;
        correctAnswer: string;
        scoringPoints: string[];
      }[] = [];

      for (const q of questions) {
        const userAnswer = answers[q.id] || "";

        if (q.type === "choice") {
          const correct = userAnswer.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
          scores[q.id] = {
            score: correct ? maxPerQ : 0,
            maxScore: maxPerQ,
            feedback: correct ? "正确！" : `正确答案是 ${q.correctAnswer}`,
          };
          totalScore += correct ? maxPerQ : 0;
        } else {
          // Essay — collect for AI grading or local heuristics
          essayQuestions.push({
            id: q.id,
            question: q.question,
            userAnswer,
            correctAnswer: q.correctAnswer,
            scoringPoints: q.scoringPoints || [],
          });
        }
      }

      // Grade essay questions
      if (essayQuestions.length > 0) {
        const aiConfig = await getUserAiConfig(user!.id);

        for (const eq of essayQuestions) {
          let essayScore = 0;
          let feedback = "";

          if (aiConfig) {
            try {
              const response = await fetch(
                `${aiConfig.baseURL}/chat/completions`,
                {
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
                          "你是考研阅卷老师。请给学生的简答题打分，只返回JSON：{\"score\": 数字, \"maxScore\": 10, \"feedback\": \"评语\"}",
                      },
                      {
                        role: "user",
                        content: `题目：${eq.question}\n参考答案：${eq.correctAnswer}\n采分点：${eq.scoringPoints.join("；")}\n学生答案：${eq.userAnswer || "（未作答）"}\n\n请打分并给出简短反馈。`,
                      },
                    ],
                    temperature: 0.3,
                    max_tokens: 512,
                  }),
                }
              );

              if (response.ok) {
                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || "";
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const result = JSON.parse(jsonMatch[0]);
                  essayScore = Math.min(result.score || 0, maxPerQ);
                  feedback = result.feedback || "";
                }
              }
            } catch (e) {
              console.error("AI essay grading failed:", e);
            }
          }

          // Local fallback for essay grading
          if (!feedback) {
            if (!eq.userAnswer || eq.userAnswer.trim().length < 10) {
              essayScore = 0;
              feedback = "未作答或回答过短";
            } else if (eq.userAnswer.length > 50) {
              essayScore = Math.round(maxPerQ * 0.7);
              feedback = `已作答（${eq.userAnswer.length}字），建议对照参考答案查漏补缺`;
            } else {
              essayScore = Math.round(maxPerQ * 0.4);
              feedback = "回答较简略，建议展开论述并覆盖更多采分点";
            }
          }

          scores[eq.id] = {
            score: essayScore,
            maxScore: maxPerQ,
            feedback,
          };
          totalScore += essayScore;
        }
      }

      const updated = await prisma.practiceSession.update({
        where: { id },
        data: {
          answers: answers as Prisma.InputJsonValue,
          scores: scores as Prisma.InputJsonValue,
          totalScore,
          status: "completed",
          completedAt: new Date(),
        },
      });

      return NextResponse.json({ session: updated });
    }

    return NextResponse.json({ error: "无效的更新" }, { status: 400 });
  } catch (err) {
    console.error("Update practice session error:", err);
    return NextResponse.json({ error: "更新练习失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const session = await prisma.practiceSession.findUnique({
      where: { id },
    });

    if (!session || session.userId !== user!.id) {
      return NextResponse.json({ error: "练习不存在" }, { status: 404 });
    }

    await prisma.practiceSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete practice session error:", err);
    return NextResponse.json({ error: "删除练习失败" }, { status: 500 });
  }
}
