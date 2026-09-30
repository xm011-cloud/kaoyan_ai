import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { addStudyDays, getStudyWeekRange, studyDateToUtc, toStudyDateString } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

type StarterItem = {
  title: string;
  description: string;
  date: string;
  duration: number;
  phase: string;
  subject: string;
  milestoneId: string;
  milestoneTitle: string;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * 首周不是“简化版长期计划”。它只建立三个学习样本，帮助用户确认自己的起点、
 * 可持续容量和课程入口；后续长期路线仍必须经过既有的资料确认流程。
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const target = cleanText(body.target, 100);
    const subject = cleanText(body.subject, 40);
    const weeklyHours = Number(body.weeklyHours);

    if (!target || !subject || !Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 84) {
      return jsonNoStore({ error: "请填写备考方向、当前最需要补的科目，以及每周可投入时间" }, { status: 400 });
    }

    const todayStr = toStudyDateString();
    const { start: weekStartStr, end: weekEndStr } = getStudyWeekRange();
    const weekStart = studyDateToUtc(weekStartStr);
    const weekEnd = studyDateToUtc(weekEndStr);
    const parsedExamYear = Number((target.match(/20\d{2}/) ?? [])[0]);
    const examYear = Number.isInteger(parsedExamYear) ? parsedExamYear : null;

    // 已有路线时不允许首周入口覆盖它；用户应从原计划的调整入口继续。
    const [existingRoute, existingWeekPlan, currentGoal, lastPath, lastWeekPlan] = await Promise.all([
      prisma.studyPath.findFirst({ where: { userId: user!.id, status: { in: ["draft", "active"] } }, select: { id: true } }),
      prisma.weeklyPlan.findFirst({ where: { userId: user!.id, weekStart, status: { in: ["draft", "active"] } }, select: { id: true } }),
      prisma.goal.findUnique({ where: { userId: user!.id } }),
      prisma.studyPath.findFirst({ where: { userId: user!.id }, orderBy: { version: "desc" }, select: { version: true } }),
      prisma.weeklyPlan.findFirst({ where: { userId: user!.id, weekStart }, orderBy: { version: "desc" }, select: { version: true } }),
    ]);

    if (existingRoute || existingWeekPlan || (currentGoal && currentGoal.status !== "exploring")) {
      return jsonNoStore({ error: "你已有正在推进的学习路线，请从计划页调整本周安排" }, { status: 409 });
    }

    const daysAvailable = Math.max(0, Math.round((weekEnd.getTime() - studyDateToUtc(todayStr).getTime()) / 86_400_000));
    const offsets = [0, 2, 4].filter((offset) => offset <= daysAvailable);

    const result = await prisma.$transaction(async (tx) => {
      const goal = await tx.goal.upsert({
        where: { userId: user!.id },
        create: {
          userId: user!.id,
          type: "postgraduate",
          status: "exploring",
          direction: target,
          examYear: examYear ?? currentGoal?.examYear ?? null,
          certainty: "low",
          subjects: [subject],
          subjectsEdited: true,
          studyLoad: { weeklyHours: Math.round(weeklyHours) },
        },
        update: {
          status: "exploring",
          direction: target,
          examYear,
          certainty: "low",
          subjects: Array.from(new Set([...(currentGoal?.subjects ?? []), subject])),
          subjectsEdited: true,
          studyLoad: { ...(currentGoal?.studyLoad as Record<string, unknown> | null ?? {}), weeklyHours: Math.round(weeklyHours) },
        },
      });

      const path = await tx.studyPath.create({
        data: {
          userId: user!.id,
          goalId: goal.id,
          title: `首周探索：${subject}`,
          description: "这不是长期计划：先完成少量学习样本，确认起点、节奏和资料入口后，再共同设计正式路线。",
          subjects: [subject],
          version: (lastPath?.version ?? 0) + 1,
          status: "active",
          confirmedAt: new Date(),
          generatedBy: "manual",
        },
      });
      const stage = await tx.studyPathStage.create({
        data: {
          studyPathId: path.id,
          key: "starter_week",
          title: "首周探索与补基础",
          order: 0,
          objective: `用 ${offsets.length} 个学习样本确认 ${subject} 的真实起点、可持续节奏与下一步。`,
          exitCriteria: [
            "完成本周可用时间内的学习样本",
            "至少留下一条自己的理解、易错点或解题思路",
            "决定下周是继续探索，还是开始共同设计正式路线",
          ],
          status: "active",
          startDate: weekStart,
          endDate: weekEnd,
        },
      });
      const milestone = await tx.studyPathMilestone.create({
        data: {
          studyPathId: path.id,
          stageId: stage.id,
          title: `${subject}的首周学习样本`,
          description: "收集少量真实学习证据，而不是用一次输入判断掌握程度。",
          phase: "探索期",
          subject,
          order: 0,
          targetDate: weekEnd,
        },
      });

      const templates = [
        {
          title: `开始 ${subject} 的第一个学习样本`,
          description: "打开你已经在用的课程、教材或资料，完成一个最小小节。不要追求进度；结束后记下一个理解点、卡点或疑问。",
          duration: 45,
        },
        {
          title: `回顾并练习 ${subject} 的基础内容`,
          description: "用自己的话复述上次内容，完成少量基础练习或例题。标记不确定之处，不用正确率替代理解。",
          duration: 35,
        },
        {
          title: `整理 ${subject} 的首周发现`,
          description: "回看本周的理解和卡点，写下：下一步该继续什么、需要补什么。它会成为正式路线讨论的依据。",
          duration: 20,
        },
      ];
      const items: StarterItem[] = offsets.map((offset, index) => ({
        ...templates[index],
        date: addStudyDays(todayStr, offset),
        phase: "探索期",
        subject,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      }));
      const plan = await tx.weeklyPlan.create({
        data: {
          userId: user!.id,
          studyPathId: path.id,
          stageId: stage.id,
          weekStart,
          weekEnd,
          version: (lastWeekPlan?.version ?? 0) + 1,
          status: "active",
          objective: `先用小样本开始 ${subject}，确认真实起点与可持续节奏。`,
          rationale: "你亲自确认了备考方向、当前薄弱科目和每周容量；本周只创建少量可见任务，不据此宣称已掌握。",
          successCriteria: stage.exitCriteria as Prisma.InputJsonValue,
          plannedMinutes: items.reduce((total, item) => total + item.duration, 0),
          items: items as unknown as Prisma.InputJsonValue,
          generatedBy: "manual",
          confirmedAt: new Date(),
        },
      });
      const tasks = await Promise.all(items.map((item) => tx.task.create({
        data: {
          userId: user!.id,
          weeklyPlanId: plan.id,
          milestoneId: milestone.id,
          title: item.title,
          description: item.description,
          date: studyDateToUtc(item.date),
          duration: item.duration,
          phase: item.phase,
          subject: item.subject,
          weekStartDate: weekStart,
          source: "manual",
          curriculumNodeIds: [],
        },
      })));

      return { goal, path, stage, milestone, plan, firstTask: tasks[0], taskCount: tasks.length };
    });

    return jsonNoStore({
      starterWeek: {
        pathId: result.path.id,
        stageId: result.stage.id,
        milestoneId: result.milestone.id,
        planId: result.plan.id,
        weekStart: weekStartStr,
        firstTaskId: result.firstTask.id,
        taskCount: result.taskCount,
      },
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "创建首周探索");
  }
}
