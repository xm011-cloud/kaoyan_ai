/**
 * pgvector utilities — store embeddings, vector similarity search via Neon PostgreSQL
 */
import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/rag";

// Store embedding for a material (fire-and-forget safe)
export async function storeEmbedding(
  materialId: string,
  text: string
): Promise<boolean> {
  const embedding = await getEmbedding(text);
  if (!embedding) return false;

  try {
    const vectorStr = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Material"
      SET embedding = ${vectorStr}::vector
      WHERE id = ${materialId}
    `;
    return true;
  } catch (e) {
    console.error("storeEmbedding failed:", e);
    return false;
  }
}

// Search materials by vector similarity (cosine distance via <=>)
export async function searchByVector(
  userId: string,
  queryEmbedding: number[],
  limit = 5
): Promise<
  { id: string; name: string; content: string; score: number }[]
> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; content: string; score: number }[]
    >(
      `SELECT m.id, m.name, m.content, 1 - (m.embedding <=> $1::vector) AS score
       FROM "Material" m
       WHERE m."userId" = $2
         AND m.embedding IS NOT NULL
         AND m.content IS NOT NULL
         AND length(m.content) > 10
       ORDER BY m.embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      userId,
      limit
    );

    return rows.filter((r) => r.score > 0.3);
  } catch (e) {
    console.error("searchByVector failed:", e);
    return [];
  }
}

// Ensure all materials for a user have embeddings (backfill)
export async function ensureEmbeddings(userId: string): Promise<{
  total: number;
  embedded: number;
}> {
  const materials = await prisma.material.findMany({
    where: {
      userId,
      content: { not: null },
      // Can't filter on Unsupported field via Prisma, so we filter in JS:
    },
    select: { id: true, content: true },
  });

  let embedded = 0;
  for (const m of materials) {
    if (!m.content || m.content.startsWith("[")) continue;

    // Check if embedding already exists via raw query
    const existing = await prisma.$queryRawUnsafe<{ has_embedding: boolean }[]>(
      `SELECT embedding IS NOT NULL AS has_embedding FROM "Material" WHERE id = $1`,
      m.id
    );

    if (existing[0]?.has_embedding) continue;

    const ok = await storeEmbedding(m.id, m.content);
    if (ok) embedded++;

    // Rate limiting: small delay between API calls
    if (embedded > 0 && embedded % 5 === 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return { total: materials.length, embedded };
}
