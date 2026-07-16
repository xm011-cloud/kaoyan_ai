import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

// POST: AI 分析用户与目标院校的匹配度
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { university, major } = body;

    if (!university) {
      return NextResponse.json(
        { error: "请指定院校" },
        { status: 400 }
      );
    }

    // Load user's goal
    const goal = await prisma.goal.findUnique({
      where: { userId: user!.id },
    });

    // Load admission data
    const admissionData = await prisma.admissionInfo.findMany({
      where: {
        university,
        ...(major ? { major } : {}),
      },
      orderBy: { year: "desc" },
    });

    const scoreLines = admissionData.filter(
      (a) => a.category === "score_line"
    );
    const enrollmentData = admissionData.filter(
      (a) => a.category === "enrollment"
    );
    const subjectData = admissionData.filter(
      (a) => a.category === "subjects"
    );

    // Load user's practice stats
    const completedSessions = await prisma.practiceSession.findMany({
      where: {
        userId: user!.id,
        status: "completed",
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // Calculate per-subject stats
    const subjectStats: Record<
      string,
      { sessions: number; avgScore: number; avgMaxScore: number }
    > = {};
    for (const s of completedSessions) {
      const subj = s.subject;
      if (!subjectStats[subj]) {
        subjectStats[subj] = { sessions: 0, avgScore: 0, avgMaxScore: 0 };
      }
      subjectStats[subj].sessions++;
      subjectStats[subj].avgScore += s.totalScore || 0;
      subjectStats[subj].avgMaxScore += s.maxScore || 0;
    }
    for (const key of Object.keys(subjectStats)) {
      const st = subjectStats[key];
      st.avgScore = Math.round(st.avgScore / st.sessions);
      st.avgMaxScore = Math.round(st.avgMaxScore / st.sessions);
    }

    // Build AI prompt context
    const targetScores = (goal?.targetScores as Record<string, number>) || {};
    const latestScoreLine = scoreLines[0];
    const admissionScores = (latestScoreLine?.data as Record<string, unknown>)?.scores as
      | Record<string, number>
      | undefined;

    const userContext = [
      goal
        ? `目标院校: ${goal.university} ${goal.major}`
        : "未设置目标院校",
      goal?.examDate
        ? `考试日期: ${new Date(goal.examDate).toLocaleDateString("zh-CN")}`
        : "",
      Object.keys(targetScores).length > 0
        ? `目标分数: ${Object.entries(targetScores)
            .map(([k, v]) => `${k} ${v}分`)
            .join(", ")}`
        : "未设置目标分数",
      Object.keys(subjectStats).length > 0
        ? `当前练习正确率: ${Object.entries(subjectStats)
            .map(
              ([k, v]) =>
                `${k} ${Math.round((v.avgScore / Math.max(1, v.avgMaxScore)) * 100)}%`
            )
            .join(", ")}`
        : "尚未完成练习",
    ]
      .filter(Boolean)
      .join("\n");

    const schoolContext = [
      `查询院校: ${university} ${major || ""}`,
      admissionScores
        ? `录取分数线: ${Object.entries(admissionScores)
            .map(([k, v]) => `${k}: ${v}分`)
            .join(", ")}`
        : "未找到分数线数据",
      enrollmentData.length > 0
        ? `招生信息: ${enrollmentData
            .map(
              (e) =>
                `${e.year}年 - ${JSON.stringify(e.data).slice(0, 200)}`
            )
            .join("; ")}`
        : "",
      subjectData.length > 0
        ? `考试科目: ${JSON.stringify(
            (subjectData[0]?.data as Record<string, unknown>)?.subjects || []
          )}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const aiConfig = await getUserAiConfig(user!.id);
    let analysis: {
      matchRate?: number;
      gap?: Record<string, number>;
      strengths?: string[];
      weaknesses?: string[];
      suggestions?: string[];
      summary?: string;
    } = {};

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
                  "你是考研择校顾问。你只返回JSON。根据学生数据和院校数据，分析匹配度、差距和建议。",
              },
              {
                role: "user",
                content: `请分析以下学生与目标院校的匹配情况。

## 学生数据
${userContext}

## 院校数据
${schoolContext}

## 输出格式（只返回JSON）
{
  "matchRate": 数字(0-100，估计的匹配度),
  "gap": {"科目名": 差距分数},
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["薄弱点1", "薄弱点2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "summary": "100字以内的综合分析"
}`,
              },
            ],
            temperature: 0.5,
            max_tokens: 2048,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          }
        }
      } catch {
        // Fall through to basic analysis
      }
    }

    // Basic analysis if AI unavailable
    if (!analysis.summary) {
      analysis = buildBasicAnalysis(
        targetScores,
        admissionScores,
        subjectStats
      );
    }

    // Save comparison record
    const comparison = await prisma.schoolComparison.create({
      data: {
        userId: user!.id,
        schools: [
          {
            university,
            major: major || "",
            scores: admissionScores || {},
            year: latestScoreLine?.year || null,
          },
        ],
        analysis: JSON.stringify(analysis),
      },
    });

    return NextResponse.json({
      analysis,
      comparisonId: comparison.id,
      admissionData: {
        scoreLines,
        enrollmentData,
        subjectData,
      },
      userData: {
        targetScores,
        subjectStats,
      },
    });
  } catch (err) {
    console.error("Admission analyze error:", err);
    return NextResponse.json({ error: "分析失败" }, { status: 500 });
  }
}

function buildBasicAnalysis(
  targetScores: Record<string, number>,
  admissionScores?: Record<string, number>,
  subjectStats?: Record<
    string,
    { sessions: number; avgScore: number; avgMaxScore: number }
  >
) {
  const gap: Record<string, number> = {};
  const weaknesses: string[] = [];
  const strengths: string[] = [];

  if (admissionScores) {
    for (const [subject, requiredScore] of Object.entries(admissionScores)) {
      const target = targetScores[subject] || requiredScore;
      const diff = target - requiredScore;
      gap[subject] = diff;
      if (diff < 0) {
        weaknesses.push(`${subject} 差 ${Math.abs(diff)} 分达到目标`);
      } else if (diff > 0) {
        strengths.push(`${subject} 超过目标 ${diff} 分`);
      }
    }
  }

  return {
    matchRate: weaknesses.length === 0 ? 70 : Math.max(30, 70 - weaknesses.length * 15),
    gap,
    strengths:
      strengths.length > 0 ? strengths : ["需要更多练习数据来评估优势"],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : ["暂无明确薄弱科目，建议持续练习"],
    suggestions: [
      "建议查看目标院校近3年分数线趋势",
      "重点攻克薄弱科目，争取每科达到目标分数",
      "关注招生人数变化，评估竞争激烈程度",
    ],
    summary: admissionScores
      ? `目标院校录取要求明确，差距分析已完成。建议针对性提升薄弱科目。`
      : "未查找到该校分数线数据，无法进行精准差距分析。建议先搜索该校录取信息。",
  };
}
