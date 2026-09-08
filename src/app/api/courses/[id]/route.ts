import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const course = await prisma.course.findFirst({
      where: { id, userId: user!.id },
      include: {
        units: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                material: { select: { id: true, name: true, type: true, url: true } },
                sessions: {
                  where: { userId: user!.id },
                  orderBy: { startedAt: "desc" },
                  take: 1,
                  select: { id: true, status: true, startedAt: true, endedAt: true, selfAssessment: true },
                },
                _count: { select: { notes: true } },
              },
            },
          },
        },
      },
    });
    if (!course) return jsonNoStore({ error: "课程不存在" }, { status: 404 });
    return jsonNoStore({ course });
  } catch (err) {
    return handleApiError(err, "获取课程详情");
  }
}
