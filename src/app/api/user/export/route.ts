import { prisma } from "@/lib/prisma";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";

// 数据导出：汇总当前用户全部学习数据为 JSON（便于备份/迁移/自行保管）。
// 排除 Chat（messages 体积大）与 Material.content / embedding（文本内容+向量）。
export async function GET() {
  const { user, error } = await getAuthUser();
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
      studyPath,
      knowledgeNodes,
      importedQuestions,
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
      prisma.studyPath.findUnique({
        where: { userId: user!.id },
        include: { milestones: { orderBy: { order: "asc" } } },
      }),
      prisma.knowledgeNode.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
      prisma.importedQuestion.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } }),
    ]);

    return jsonNoStore({
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
        studyPath,
        knowledgeNodes,
        importedQuestions,
      },
    });
  } catch (err) {
    return handleApiError(err, "导出数据");
  }
}
