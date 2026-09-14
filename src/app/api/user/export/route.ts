import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { NextRequest } from "next/server";

// 数据导出：汇总当前用户全部学习数据为 JSON（便于备份/迁移/自行保管）。
// 排除 Chat（messages 体积大）与 Material.content / embedding（文本内容+向量）。
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const [
      goal,
      tasks,
      checkIns,
      materials,
      feedbacks,
      wrongQuestions,
      practiceSessions,
      pomodoroSessions,
      studyPaths,
      weeklyPlans,
      studyProfileFacts,
      knowledgeNodes,
      importedQuestions,
      studyEvidence,
    ] = await Promise.all([
      prisma.goal.findUnique({ where: { userId: user!.id } }),
      prisma.task.findMany({ where: { userId: user!.id }, orderBy: { date: "asc" } }),
      prisma.checkIn.findMany({ where: { userId: user!.id }, orderBy: { date: "asc" } }),
      prisma.material.findMany({
        where: { userId: user!.id },
        select: { id: true, name: true, type: true, url: true, size: true, createdAt: true, updatedAt: true },
      }),
      prisma.feedback.findMany({ where: { userId: user!.id }, orderBy: { weekStart: "asc" } }),
      prisma.wrongQuestion.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.practiceSession.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.pomodoroSession.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.studyPath.findMany({
        where: { userId: user!.id },
        orderBy: { version: "asc" },
        include: {
          stages: { orderBy: { order: "asc" } },
          milestones: { orderBy: { order: "asc" } },
        },
      }),
      prisma.weeklyPlan.findMany({
        where: { userId: user!.id },
        orderBy: [{ weekStart: "asc" }, { version: "asc" }],
      }),
      prisma.studyProfileFact.findMany({
        where: { userId: user!.id },
        orderBy: [{ key: "asc" }, { observedAt: "asc" }],
      }),
      prisma.knowledgeNode.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.importedQuestion.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.studyEvidence.findMany({ where: { userId: user!.id }, orderBy: { occurredAt: "asc" } }),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      app: "AI 考研助手",
      user: { id: user!.id, email: user!.email },
      data: {
        goal,
        tasks,
        checkIns,
        materials, // 仅元数据（不含提取文本/向量）
        feedbacks,
        wrongQuestions,
        practiceSessions,
        pomodoroSessions,
        studyPaths,
        weeklyPlans,
        studyProfileFacts,
        knowledgeNodes,
        importedQuestions,
        studyEvidence,
      },
    };

    // 附件响应让浏览器接管下载，避免客户端 Blob 在移动浏览器和受限 WebView
    // 中被拦截；未带 download 参数时仍返回原有 JSON API，保持兼容。
    if (request.nextUrl.searchParams.get("download") === "1") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify(payload, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="kaoyan-export-${date}.json"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return jsonNoStore(payload);
  } catch (err) {
    return handleApiError(err, "导出数据");
  }
}
