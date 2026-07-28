import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST: 自动构建知识图谱
// 扫描错题的 tags 和科目，创建知识点节点；根据同一错题的 tags 共现关系创建边
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const userId = user!.id;

    // 1. Get all wrong questions with tags
    const wqs = await prisma.wrongQuestion.findMany({
      where: { userId },
      select: { subject: true, tags: true, reviewed: true },
    });

    if (wqs.length === 0) {
      return NextResponse.json({
        success: true,
        nodesCreated: 0,
        edgesCreated: 0,
        message: "还没有错题数据，请先添加错题",
      });
    }

    // 2. Build tag frequency map per subject: { subject: { tag: { total, unreviewed } } }
    const tagMap = new Map<string, Map<string, { total: number; unreviewed: number }>>();
    for (const wq of wqs) {
      if (!tagMap.has(wq.subject)) {
        tagMap.set(wq.subject, new Map());
      }
      const subjectTags = tagMap.get(wq.subject)!;
      for (const tag of wq.tags) {
        const existing = subjectTags.get(tag) || { total: 0, unreviewed: 0 };
        existing.total++;
        if (!wq.reviewed) existing.unreviewed++;
        subjectTags.set(tag, existing);
      }
    }

    const subjects = [...new Set(wqs.map((w) => w.subject))];

    // 3. Batch upsert nodes using $transaction
    const nodeMap = new Map<string, string>(); // "subject||name" → nodeId
    const nodeKeys: string[] = [];
    const nodeOps = [];

    for (const subject of subjects) {
      const tags = tagMap.get(subject);
      if (!tags) continue;

      for (const [tag, stats] of tags) {
        const key = `${subject}||${tag}`;
        const totalWeight = Math.log2(stats.total + 1) + 1;
        const mastery = stats.total > 0
          ? Math.max(0, 1 - stats.unreviewed / stats.total)
          : 0;

        nodeKeys.push(key);
        nodeOps.push(
          prisma.knowledgeNode.upsert({
            where: {
              userId_name_subject: { userId, name: tag, subject },
            },
            create: {
              userId,
              name: tag,
              subject,
              category: "concept",
              weight: totalWeight,
              mastery,
            },
            update: {
              weight: totalWeight,
              mastery,
            },
          })
        );
      }
    }

    const nodeResults = await prisma.$transaction(nodeOps);
    for (let i = 0; i < nodeResults.length; i++) {
      nodeMap.set(nodeKeys[i], nodeResults[i].id);
    }

    // 4. Build edges from tag co-occurrence within the same question
    const coOccurrence = new Map<string, number>(); // "nodeId1||nodeId2" → count
    for (const wq of wqs) {
      if (wq.tags.length < 2) continue;
      const nodeIds = wq.tags
        .map((t) => nodeMap.get(`${wq.subject}||${t}`))
        .filter(Boolean) as string[];

      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const [a, b] = nodeIds[i] < nodeIds[j] ? [nodeIds[i], nodeIds[j]] : [nodeIds[j], nodeIds[i]];
          const pairKey = `${a}||${b}`;
          coOccurrence.set(pairKey, (coOccurrence.get(pairKey) || 0) + 1);
        }
      }
    }

    // 5. Batch upsert edges using $transaction
    const edgeOps = [];
    for (const [pairKey, count] of coOccurrence) {
      const [fromId, toId] = pairKey.split("||");
      edgeOps.push(
        prisma.knowledgeEdge.upsert({
          where: { fromId_toId: { fromId, toId } },
          create: {
            fromId,
            toId,
            relation: count >= 3 ? "prerequisite" : "related",
            label: count >= 3 ? `共现${count}次` : undefined,
          },
          update: {
            label: count >= 3 ? `共现${count}次` : undefined,
          },
        })
      );
    }

    let edgesCreated = 0;
    if (edgeOps.length > 0) {
      try {
        const edgeResults = await prisma.$transaction(edgeOps);
        edgesCreated = edgeResults.length;
      } catch {
        // Skip if some edges fail due to missing nodes
        edgesCreated = 0;
      }
    }

    return NextResponse.json({
      success: true,
      nodesCreated: nodeMap.size,
      edgesCreated,
    });
  } catch (err) {
    console.error("Build knowledge-graph error:", err);
    return NextResponse.json({ error: "构建知识图谱失败" }, { status: 500 });
  }
}
