import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildClosureHealth, type ClosureHealthActivity } from "@/lib/closure-health";

/**
 * 发布后狗粮期的学习闭环健康度。只读、仅管理员可见。
 * 不新增行为追踪；从任务、学习会话、理解卡、节点关联和回顾记录中汇总事实。
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const [
      users,
      taskUsers,
      completedTaskUsers,
      completedStudyUsers,
      completedPracticeUsers,
      notes,
      reviewedNoteUsers,
      reviewedWrongQuestionUsers,
    ] = await Promise.all([
      prisma.user.findMany({ select: { id: true } }),
      prisma.task.groupBy({ by: ["userId"] }),
      prisma.task.groupBy({ by: ["userId"], where: { completed: true } }),
      prisma.studySession.groupBy({ by: ["userId"], where: { status: "completed" } }),
      prisma.practiceSession.groupBy({ by: ["userId"], where: { status: "completed" } }),
      prisma.studyNote.findMany({
        select: {
          userId: true,
          curriculumNodeIds: true,
          knowledgeLinks: { select: { nodeId: true } },
        },
      }),
      prisma.studyNote.groupBy({ by: ["userId"], where: { reviewCount: { gt: 0 } } }),
      prisma.wrongQuestion.groupBy({ by: ["userId"], where: { reviewCount: { gt: 0 } } }),
    ]);

    const ids = (rows: { userId: string }[]) => new Set(rows.map((row) => row.userId));
    const taskIds = ids(taskUsers);
    const completedTaskIds = ids(completedTaskUsers);
    const completedStudyIds = new Set([...ids(completedStudyUsers), ...ids(completedPracticeUsers)]);
    const reviewedIds = new Set([...ids(reviewedNoteUsers), ...ids(reviewedWrongQuestionUsers)]);
    const noteIds = new Set(notes.map((note) => note.userId));
    const linkedIds = new Set(
      notes
        .filter((note) => note.curriculumNodeIds.length > 0 || note.knowledgeLinks.length > 0)
        .map((note) => note.userId)
    );

    const activities: ClosureHealthActivity[] = users.map((user) => ({
      hasTask: taskIds.has(user.id),
      hasCompletedTask: completedTaskIds.has(user.id),
      hasCompletedStudy: completedStudyIds.has(user.id),
      hasUnderstanding: noteIds.has(user.id),
      hasKnowledgeLink: linkedIds.has(user.id),
      hasReview: reviewedIds.has(user.id),
    }));

    return jsonNoStore(buildClosureHealth(activities));
  } catch (err) {
    return handleApiError(err, "查询学习闭环健康度");
  }
}
