import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取用户知识图谱数据
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");

    const where: Record<string, unknown> = { userId: user!.id };
    if (subject) where.subject = subject;

    const [nodes, edges] = await Promise.all([
      prisma.knowledgeNode.findMany({
        where,
        orderBy: { weight: "desc" },
      }),
      prisma.knowledgeEdge.findMany({
        where: {
          from: { userId: user!.id },
        },
        include: {
          from: { select: { id: true, name: true, subject: true } },
          to: { select: { id: true, name: true, subject: true } },
        },
      }),
    ]);

    // Get subjects list for filter
    const subjects = await prisma.knowledgeNode.findMany({
      where: { userId: user!.id },
      distinct: ["subject"],
      select: { subject: true },
    });

    return NextResponse.json({
      nodes,
      edges,
      subjects: subjects.map((s) => s.subject),
    });
  } catch (err) {
    console.error("Get knowledge-graph error:", err);
    return NextResponse.json({ error: "获取知识图谱失败" }, { status: 500 });
  }
}

// POST: 手动添加/更新知识点
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { name, subject, category, mastery } = body;

    if (!name || !subject) {
      return NextResponse.json(
        { error: "知识点名称和科目不能为空" },
        { status: 400 }
      );
    }

    const node = await prisma.knowledgeNode.upsert({
      where: {
        userId_name_subject: {
          userId: user!.id,
          name,
          subject,
        },
      },
      create: {
        userId: user!.id,
        name,
        subject,
        category: category || "concept",
        mastery: mastery ?? 0,
      },
      update: {
        category: category || undefined,
        mastery: mastery ?? undefined,
      },
    });

    return NextResponse.json({ node });
  } catch (err) {
    console.error("Create knowledge-node error:", err);
    return NextResponse.json({ error: "添加知识点失败" }, { status: 500 });
  }
}
