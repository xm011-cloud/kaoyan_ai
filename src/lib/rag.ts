/**
 * RAG utilities — text extraction, embedding, similarity search
 */
import { inflateSync } from "zlib";

// Minimal PDF text extraction using only Node.js built-ins (no pdf2json dependency)
function extractPdfTextFromBuffer(buffer: Buffer): string {
  const content = buffer.toString("latin1");
  const texts: string[] = [];

  // Find all stream objects with their dictionary
  const objRegex = /(\d+ \d+ obj[\s\S]*?endobj)/g;
  let objMatch;
  while ((objMatch = objRegex.exec(content)) !== null) {
    const obj = objMatch[1];

    // Check if it contains a stream
    const streamStart = obj.indexOf("stream\r\n");
    const streamStart2 = obj.indexOf("stream\n");
    const start = streamStart >= 0 ? streamStart + 8 : streamStart2 >= 0 ? streamStart2 + 7 : -1;
    if (start < 0) continue;

    const endstream = obj.indexOf("endstream", start);
    if (endstream < 0) continue;

    // Check for FlateDecode (zlib) filter
    const dict = obj.substring(0, start);
    const useZlib = dict.includes("FlateDecode");

    // Extract the stream content
    const streamData = obj.substring(start, endstream).trim();

    // Get text content
    let textContent = "";
    if (useZlib) {
      try {
        const decompressed = inflateSync(Buffer.from(streamData, "latin1"));
        textContent = decompressed.toString("utf-8");
      } catch {
        textContent = streamData;
      }
    } else {
      textContent = streamData;
    }

    // Extract text between BT and ET operators
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch;
    while ((btMatch = btRegex.exec(textContent)) !== null) {
      const btBlock = btMatch[1];
      // Extract text from Tj, TJ, and ' operators
      // Tj: (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(btBlock)) !== null) {
        texts.push(tjMatch[1]);
      }
      // TJ: [(text1) num (text2) ...] TJ
      const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let taMatch;
      while ((taMatch = tjArrayRegex.exec(btBlock)) !== null) {
        const inner = taMatch[1];
        const innerTexts = inner.match(/\(([^)]*)\)/g);
        if (innerTexts) {
          texts.push(...innerTexts.map((t) => t.slice(1, -1)));
        }
      }
    }
  }

  const result = texts.join(" ");
  return result || "[PDF 未检测到文本内容，可能为扫描件或图片型 PDF，建议将内容复制为 .txt 文件上传]";
}

// Extract text from file buffer
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Plain text
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf-8").slice(0, 50000);
  }

  // PDF: extract text with built-in buffer search (no external dependency)
  if (mimeType === "application/pdf") {
    try {
      const text = extractPdfTextFromBuffer(buffer);
      return text.slice(0, 50000);
    } catch (e) {
      console.error("PDF parse error:", e);
      return "[PDF 解析失败，建议将内容复制为 .txt 文件后上传]";
    }
  }

  // Word documents
  if (
    mimeType.includes("word") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return `[Word 文件，需要文档解析器提取文本。建议将内容复制为 .txt 文件后上传。]`;
  }

  // Images
  if (mimeType.startsWith("image/")) {
    return `[图片文件，内容无法直接提取文本。]`;
  }

  return `[${mimeType} 文件]`;
}

// Get MiMo embedding for a text
export async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) return null;

  const baseURL = process.env.OPENAI_BASE_URL || "https://api.xiaomimimo.com/v1";

  try {
    const response = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "mimo-v2.5-pro",
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Search materials by embedding similarity (returns sorted by score)
// Now uses pgvector first, falls back to in-memory/keyword search
export async function searchMaterials(
  query: string,
  materials: { id: string; name: string; content: string | null }[],
  userId?: string
): Promise<{ id: string; name: string; content: string; score: number }[]> {
  const queryEmbedding = await getEmbedding(query);

  // Try pgvector search first (if userId provided and embedding available)
  if (queryEmbedding && userId) {
    try {
      const { searchByVector } = await import("@/lib/vector");
      const pgResults = await searchByVector(userId, queryEmbedding, 5);
      if (pgResults.length > 0) return pgResults;
    } catch {
      // pgvector unavailable, fall through to in-memory / keyword search
    }
  }

  if (queryEmbedding) {
    // Semantic search via embeddings (in-memory fallback)
    const scored = await Promise.all(
      materials
        .filter((m) => m.content && m.content.length > 10)
        .map(async (m) => {
          const emb = await getEmbedding(m.content!);
          const score = emb ? cosineSimilarity(queryEmbedding, emb) : 0;
          return { id: m.id, name: m.name, content: m.content!, score };
        })
    );
    const results = scored
      .filter((s) => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (results.length > 0) return results;
  }

  // Fallback: keyword overlap search (handles Chinese via bigrams + full word matching)
  const queryLower = query.toLowerCase();
  // For Chinese: extract meaningful substrings (2-4 chars) from the query
  const chineseWords: string[] = [];
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= query.length - len; i++) {
      const sub = query.substring(i, i + len);
      if (/[一-鿿]/.test(sub)) chineseWords.push(sub);
    }
  }
  // Also include the full query and whitespace-split words for English
  const allWords = [
    ...new Set([queryLower, ...chineseWords, ...queryLower.split(/\s+/)]),
  ].filter((w) => w.length > 1);

  return materials
    .filter((m) => m.content && m.content.length > 10)
    .map((m) => {
      const contentLower = m.content!.toLowerCase();
      const matches = allWords.filter((w) => contentLower.includes(w));
      return {
        id: m.id,
        name: m.name,
        content: m.content!,
        score: matches.length / Math.max(5, 1),
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Find the most relevant text segments within a content
export function findRelevantSegments(
  query: string,
  content: string,
  maxSegments = 3
): string[] {
  // Extract Chinese+English words from query
  const queryLower = query.toLowerCase();
  const keywords: string[] = [];
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= query.length - len; i++) {
      const sub = query.substring(i, i + len);
      if (/[一-鿿]/.test(sub)) keywords.push(sub);
    }
  }
  keywords.push(...queryLower.split(/\s+/).filter(w => w.length > 1));

  // Split content into sentences (Chinese: by 。！？；\n, English: by .!?)
  const sentences = content.split(/(?<=[。！？；\n\.!\?])/g).filter(s => s.trim());

  // Score each sentence by keyword hit count
  const scored = sentences.map(s => {
    const lower = s.toLowerCase();
    const hits = keywords.filter(k => lower.includes(k));
    return { text: s.trim(), score: hits.length };
  });

  // Group adjacent scored sentences into windows of ~200 chars
  const segments: { text: string; score: number }[] = [];
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].score === 0) continue;
    let window = scored[i].text;
    let totalScore = scored[i].score;
    // expand to nearby high-scoring sentences
    for (let j = i + 1; j < scored.length && window.length < 250; j++) {
      if (scored[j].score > 0) {
        window += scored[j].text;
        totalScore += scored[j].score;
        i = j;
      } else if (window.length < 180) {
        window += scored[j].text;
      } else break;
    }
    segments.push({ text: window.slice(0, 300), score: totalScore });
  }

  return segments
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSegments)
    .map(s => s.text);
}

// Build RAG context from search results
export function buildRagContext(
  results: { name: string; content: string; score: number }[]
): string {
  if (results.length === 0) return "";
  return results
    .map(
      (r, i) =>
        `[资料${i + 1}: ${r.name}]\n${r.content.slice(0, 3000)}`
    )
    .join("\n\n---\n\n");
}
