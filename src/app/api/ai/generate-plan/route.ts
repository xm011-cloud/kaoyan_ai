import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

interface PlanTask {
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD
  duration: number;  // 分钟
  phase: string;
  subject: string;
}

// 本地生成计划的兜底方案（无需 AI Key）
function generateLocalPlan(subjects: string[], examDate: Date): PlanTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));
  const tasks: PlanTask[] = [];

  // 三个阶段
  const phases = [
    { name: "基础阶段", ratio: 0.4, desc: "系统学习基础知识，打牢基础" },
    { name: "强化阶段", ratio: 0.35, desc: "重点突破，刷题强化" },
    { name: "冲刺阶段", ratio: 0.25, desc: "模拟冲刺，查漏补缺" },
  ];

  let dayOffset = 0;
  for (const phase of phases) {
    const phaseDays = Math.ceil(totalDays * phase.ratio);
    // 每个科目在每阶段分配 2-3 个里程碑任务
    for (const subject of subjects) {
      // 起始任务
      const startDate = new Date(today.getTime() + dayOffset * 86400000);
      tasks.push({
        title: `[${phase.name}] ${subject} - 开始学习`,
        description: `${phase.desc}：系统规划${subject}的学习内容`,
        date: startDate.toISOString().split("T")[0],
        duration: 90,
        phase: phase.name,
        subject,
      });

      // 中期任务
      const midOffset = dayOffset + Math.floor(phaseDays / 2);
      if (midOffset < totalDays) {
        const midDate = new Date(today.getTime() + midOffset * 86400000);
        tasks.push({
          title: `[${phase.name}] ${subject} - 阶段检测`,
          description: `完成${subject}${phase.name}中期自测，总结错题`,
          date: midDate.toISOString().split("T")[0],
          duration: 120,
          phase: phase.name,
          subject,
        });
      }

      // 收尾任务
      const endOffset = dayOffset + phaseDays - 1;
      if (endOffset > dayOffset && endOffset < totalDays) {
        const endDate = new Date(today.getTime() + endOffset * 86400000);
        tasks.push({
          title: `[${phase.name}] ${subject} - 阶段总结`,
          description: `回顾${subject}${phase.name}学习成果，整理知识框架`,
          date: endDate.toISOString().split("T")[0],
          duration: 90,
          phase: phase.name,
          subject,
        });
      }

      // 每周常规任务（每 7 天一个）
      for (let d = dayOffset + 1; d < dayOffset + phaseDays; d += 7) {
        if (d < totalDays) {
          const taskDate = new Date(today.getTime() + d * 86400000);
          tasks.push({
            title: `${subject} - 本周复盘`,
            description: `复习本周${subject}错题和笔记`,
            date: taskDate.toISOString().split("T")[0],
            duration: 60,
            phase: phase.name,
            subject,
          });
        }
      }
    }
    dayOffset += phaseDays;
  }

  // 按日期排序
  tasks.sort((a, b) => a.date.localeCompare(b.date));

  // 去重（同一天同科目同阶段只保留一个）
  const seen = new Set<string>();
  return tasks.filter(t => {
    const key = `${t.date}-${t.subject}-${t.phase}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    // 获取用户目标
    const goal = await prisma.goal.findUnique({
      where: { userId: user!.id },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "请先设置考研目标" },
        { status: 400 }
      );
    }

    const examDate = new Date(goal.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));

    // 删除旧计划
    await prisma.task.deleteMany({
      where: { userId: user!.id },
    });

    const aiConfig = await getUserAiConfig(user!.id);

    let planTasks: PlanTask[];

    if (aiConfig) {
      const { apiKey, baseURL, model } = aiConfig;

      const targetScores = (goal.targetScores as Record<string, number>) || {};
      const scoreContext = Object.keys(targetScores).length > 0
        ? `\n- 目标分数：${Object.entries(targetScores).map(([k, v]) => `${k}: ${v}分`).join("、")}`
        : "";

      const prompt = `你是一名资深的考研辅导专家。请根据以下信息为用户生成一份详细的考研复习计划。

## 用户目标
- 目标院校：${goal.university}
- 目标专业：${goal.major}
- 考试日期：${goal.examDate.toISOString().split("T")[0]}
- 距考试还有：${daysRemaining} 天
- 考试科目：${goal.subjects.join("、")}${scoreContext}

## 要求
${Object.keys(targetScores).length > 0 ? `- 用户已设定各科目标分数，弱势科目（分数较低的科目）应安排更多学习时间\n` : ""}
1. 将复习划分为三个阶段：基础阶段（前40%时间）、强化阶段（中间35%时间）、冲刺阶段（最后25%时间）
2. 每个科目在每个阶段安排若干学习任务
3. 每个任务包含：标题(title)、详细描述(description)、日期(date, YYYY-MM-DD格式)、预计时长分钟数(duration)、阶段名称(phase)、科目(subject)
4. 任务要具体、可执行，例如"完成660题第一章并整理错题"而不是笼统的"做题"
5. 每天安排2-4个任务，总时长控制在3-6小时
6. 注意科目间的交叉搭配，不要同一天全部安排同一科目

## 输出格式
请只返回一个JSON数组，不要包含任何其他文字：
[{
  "title": "高数 - 完成第一章极限与连续课后习题",
  "description": "重点掌握极限的定义、性质和计算方法，完成课后1-25题，整理错题到错题本",
  "date": "2026-07-14",
  "duration": 120,
  "phase": "基础阶段",
  "subject": "数学一"
}]`;

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
              { role: "system", content: "你是一个考研辅导专家，擅长制定详细的学习计划。你只返回JSON，不返回其他内容。" },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 16384,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          console.log("AI plan response length:", content.length);

          // fallback: 推理模型可能把内容放在 reasoning_content 中
          const reasoning = data.choices?.[0]?.message?.reasoning_content || "";
          let fullContent = content || reasoning;

          // 去掉 markdown 代码块标记
          fullContent = fullContent.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");

          // 提取 JSON 数组
          const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            planTasks = JSON.parse(jsonMatch[0]);
          } else {
            console.error("AI 返回格式不正确，前200字:", fullContent.substring(0, 200));
            throw new Error("AI 返回格式不正确");
          }
        } else {
          const errText = await response.text();
          console.error("MiMo API error:", errText.substring(0, 300));
          throw new Error("AI 服务调用失败");
        }
      } catch (e) {
        console.error("Plan generation AI fallback:", e instanceof Error ? e.message : String(e));
        // AI 调用失败，回退到本地生成
        planTasks = generateLocalPlan(goal.subjects, examDate);
      }
    } else {
      // 没有 AI Key，使用本地生成
      planTasks = generateLocalPlan(goal.subjects, examDate);
    }

    // 批量创建任务
    const created = await Promise.all(
      planTasks.map((t) =>
        prisma.task.create({
          data: {
            userId: user!.id,
            title: t.title,
            description: t.description,
            date: new Date(t.date),
            duration: Math.min(Math.max(t.duration || 60, 15), 480),
            phase: t.phase,
            subject: t.subject,
          },
        })
      )
    );

    // 统计信息
    const phaseStats: Record<string, number> = {};
    for (const t of planTasks) {
      phaseStats[t.phase] = (phaseStats[t.phase] || 0) + 1;
    }

    return NextResponse.json({
      tasks: created,
      totalTasks: created.length,
      daysRemaining,
      phases: phaseStats,
      generatedBy: aiConfig ? "ai" : "local",
    });
  } catch (err) {
    console.error("Generate plan error:", err);
    return NextResponse.json(
      { error: "生成计划失败，请稍后再试" },
      { status: 500 }
    );
  }
}
