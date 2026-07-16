import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    // 计算本周范围
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 检查是否已有本周反馈
    const existing = await prisma.feedback.findFirst({
      where: { userId: user!.id, weekStart, weekEnd },
    });
    if (existing) {
      return NextResponse.json({ feedback: existing, regenerated: false });
    }

    // 收集数据
    const weekCheckIns = await prisma.checkIn.findMany({
      where: { userId: user!.id, date: { gte: weekStart, lte: weekEnd } },
      orderBy: { date: "asc" },
    });
    const weekTasks = await prisma.task.findMany({
      where: { userId: user!.id, date: { gte: weekStart, lte: weekEnd } },
    });
    const goal = await prisma.goal.findUnique({ where: { userId: user!.id } });

    const totalMinutes = weekCheckIns.reduce((s, c) => s + c.duration, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const checkInDays = weekCheckIns.length;
    const taskTotal = weekTasks.length;
    const taskCompleted = weekTasks.filter(t => t.completed).length;
    const moodCounts: Record<string, number> = {};
    weekCheckIns.forEach(c => { moodCounts[c.status] = (moodCounts[c.status] || 0) + 1; });

    // Practice session stats for gap analysis
    const recentSessions = await prisma.practiceSession.findMany({
      where: { userId: user!.id, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const subjectScores: Record<string, { total: number; max: number; count: number }> = {};
    for (const s of recentSessions) {
      if (!subjectScores[s.subject]) subjectScores[s.subject] = { total: 0, max: 0, count: 0 };
      subjectScores[s.subject].total += s.totalScore || 0;
      subjectScores[s.subject].max += s.maxScore || 0;
      subjectScores[s.subject].count++;
    }

    const targetScores = (goal?.targetScores as Record<string, number>) || {};
    let scoreGap = "";
    if (Object.keys(targetScores).length > 0 && Object.keys(subjectScores).length > 0) {
      const gaps: string[] = [];
      for (const [subj, target] of Object.entries(targetScores)) {
        const st = subjectScores[subj];
        if (st && st.count > 0) {
          const pct = Math.round((st.total / Math.max(1, st.max)) * 100);
          const estimated = Math.round((pct / 100) * 150); // rough 150-scale
          const gap = estimated - target;
          gaps.push(`${subj}: 当前估分${estimated} / 目标${target} (${gap >= 0 ? "+" : ""}${gap})`);
        }
      }
      if (gaps.length > 0) scoreGap = `\n- 分数差距：${gaps.join("、")}`;
    }

    const dataSummary = `本周学习数据：
- 总学习时长：${totalHours} 小时
- 打卡天数：${checkInDays}/7 天
- 任务完成：${taskCompleted}/${taskTotal}
- 状态分布：${Object.entries(moodCounts).map(([k,v]) => `${k === 'good' ? '状态好' : k === 'normal' ? '一般' : '疲惫'} ${v}天`).join('，')}${scoreGap}
${goal ? `- 目标院校：${goal.university} ${goal.major}，考试日期：${goal.examDate.toISOString().split("T")[0]}` : ''}`;

    const aiConfig = await getUserAiConfig(user!.id);
    let content = "";
    let suggestions: string[] = [];

    if (aiConfig) {
      const { apiKey, baseURL, model } = aiConfig;

      try {
        const response = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "你是考研辅导专家，负责分析学生的学习数据并给出个性化反馈。回复格式：第一段是总结（200字内），然后用 --- 分隔，之后每行一条建议（以 - 开头）。",
              },
              {
                role: "user",
                content: `请根据以下学习数据分析并给出本周反馈：\n\n${dataSummary}\n\n要求：\n1. 先给出本周总结（包含鼓励和数据分析）\n2. 用 --- 分隔\n3. 然后列出3-5条具体建议，每条以 - 开头\n4. 建议要结合目标和考试日期，有可操作性`,
              },
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          const parts = text.split("---");
          content = parts[0]?.trim() || text;
          suggestions = (parts[1] || "")
            .split("\n")
            .map((l: string) => l.replace(/^[-*\d.]\s*/, "").trim())
            .filter(Boolean);
        } else {
          throw new Error("AI 服务不可用");
        }
      } catch {
        // fallback to local
      }
    }

    // 本地兜底
    if (!content) {
      const completionRate = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;
      content = `本周你累计学习 ${totalHours} 小时，打卡 ${checkInDays} 天` +
        (taskTotal > 0 ? `，完成任务 ${taskCompleted}/${taskTotal}（${completionRate}%）` : "") +
        `。${checkInDays >= 5 ? '表现很出色，继续保持！' : checkInDays >= 3 ? '状态不错，还有提升空间。' : '这周学习时间偏少，下周加油！'}`;

      suggestions = [];
      if (checkInDays < 5) suggestions.push("尽量每天坚持学习打卡，即使只学30分钟也很有价值");
      if (taskTotal > 0 && taskCompleted / taskTotal < 0.7) suggestions.push("任务完成率偏低，建议合理规划每天的任务量，留出缓冲时间");
      if (totalMinutes < 600) suggestions.push("本周总学习时长不足10小时，建议下周增加到每天至少2小时");
      if (goal) {
        const daysLeft = Math.max(0, Math.ceil((new Date(goal.examDate).getTime() - today.getTime()) / 86400000));
        if (daysLeft < 90) suggestions.push(`距离考试仅剩${daysLeft}天，建议进入冲刺阶段，重点刷真题`);
        else if (daysLeft < 180) suggestions.push(`距离考试${daysLeft}天，建议进入强化阶段，突破薄弱科目`);
        else suggestions.push(`距离考试还有${daysLeft}天，打好基础是关键`);
      }
      suggestions.push("每周末复盘本周错题和笔记，形成知识闭环");
    }

    // 保存
    const feedback = await prisma.feedback.create({
      data: {
        userId: user!.id,
        weekStart,
        weekEnd,
        content,
        suggestions,
      },
    });

    return NextResponse.json({ feedback, regenerated: true });
  } catch (err) {
    console.error("Generate feedback error:", err);
    return NextResponse.json({ error: "生成反馈失败" }, { status: 500 });
  }
}
