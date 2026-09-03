import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { analyzePlanningStatement, buildInterviewFacts, type PlanningInterviewAnswers } from "@/lib/study-profile";
import type { Prisma } from "@prisma/client";

function getWeeklyHours(studyLoad: unknown): number | null {
  if (!studyLoad || typeof studyLoad !== "object" || Array.isArray(studyLoad)) return null;
  const value = (studyLoad as { weeklyHours?: unknown }).weeklyHours;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

async function getContext(userId: string) {
  const goal = await prisma.goal.findUnique({ where: { userId } });
  return {
    examDate: goal?.examDate,
    examYear: goal?.examYear,
    university: goal?.university,
    major: goal?.major,
    subjects: goal?.subjects,
    weeklyHours: getWeeklyHours(goal?.studyLoad),
  };
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const facts = await prisma.studyProfileFact.findMany({
      where: { userId: user!.id, status: "confirmed" },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    });
    return jsonNoStore({ facts });
  } catch (err) {
    return handleApiError(err, "获取学习档案");
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "confirm" ? "confirm" : "analyze";
    const statement = typeof body.statement === "string" ? body.statement.trim() : "";
    if (!statement) return jsonNoStore({ error: "请先描述你的目标和当前学习情况" }, { status: 400 });
    if (statement.length > 2000) return jsonNoStore({ error: "描述请控制在 2000 字以内" }, { status: 400 });

    const answers: PlanningInterviewAnswers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? Object.fromEntries(Object.entries(body.answers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {};
    const analysis = analyzePlanningStatement(statement, await getContext(user!.id));
    if (action === "analyze") return jsonNoStore({ analysis });
    const factsToSave = [...analysis.facts, ...buildInterviewFacts(answers)];
    const weeklyHours = Number(answers.weekly_capacity);
    const examYearMatch = answers.exam_time?.match(/20\d{2}/);
    const examYear = examYearMatch ? Number(examYearMatch[0]) : null;

    const savedFacts = await prisma.$transaction(async (tx) => {
      const observedAt = new Date();
      const factKeys = Array.from(new Set(factsToSave.map((fact) => fact.key)));
      // 版本历史保留为 superseded；批量写入避免远程数据库下每个事实一次往返导致事务超时。
      await tx.studyProfileFact.updateMany({
        where: { userId: user!.id, key: { in: factKeys }, status: "confirmed" },
        data: { status: "superseded" },
      });
      await tx.studyProfileFact.createMany({
        data: factsToSave.map((fact) => ({
          userId: user!.id,
          key: fact.key,
          label: fact.label,
          value: fact.value as Prisma.InputJsonValue,
          source: fact.source,
          confidence: fact.confidence,
          status: "confirmed",
          observedAt,
        })),
      });
      const goal = await tx.goal.findUnique({ where: { userId: user!.id } });
      if (goal && Number.isFinite(weeklyHours) && weeklyHours > 0 && weeklyHours <= 80) {
        const currentLoad = goal.studyLoad && typeof goal.studyLoad === "object" && !Array.isArray(goal.studyLoad)
          ? goal.studyLoad as Prisma.InputJsonObject
          : {};
        await tx.goal.update({
          where: { id: goal.id },
          data: { studyLoad: { ...currentLoad, weeklyHours } },
        });
      }
      if (goal && examYear && examYear >= new Date().getFullYear() && examYear <= new Date().getFullYear() + 10) {
        await tx.goal.update({ where: { id: goal.id }, data: { examYear } });
      }
      return tx.studyProfileFact.findMany({
        where: { userId: user!.id, key: { in: factKeys }, status: "confirmed" },
        orderBy: { createdAt: "asc" },
      });
    }, { maxWait: 5000, timeout: 15000 });

    return jsonNoStore({ analysis, facts: savedFacts });
  } catch (err) {
    return handleApiError(err, "更新学习档案");
  }
}

// 不物理删除历史：用户撤回某条记忆后标记 rejected，后续规划立即停止使用。
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const id = request.nextUrl.searchParams.get("id");
    const ids = request.nextUrl.searchParams.get("ids")
      ?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
    if (ids.length > 0) {
      const result = await prisma.studyProfileFact.updateMany({
        where: { id: { in: ids }, userId: user!.id, status: { not: "rejected" } },
        data: { status: "rejected" },
      });
      return jsonNoStore({ rejectedCount: result.count });
    }
    if (!id) return jsonNoStore({ error: "缺少档案事实 ID" }, { status: 400 });
    const fact = await prisma.studyProfileFact.findFirst({ where: { id, userId: user!.id } });
    if (!fact) return jsonNoStore({ error: "档案事实不存在" }, { status: 404 });
    if (fact.status === "rejected") return jsonNoStore({ fact, alreadyRejected: true });

    const updated = await prisma.studyProfileFact.update({
      where: { id: fact.id },
      data: { status: "rejected" },
    });
    return jsonNoStore({ fact: updated });
  } catch (err) {
    return handleApiError(err, "撤回学习档案");
  }
}
