/**
 * RAG utilities — text extraction, embedding, similarity search
 */

// Extract text from file buffer
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Plain text
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf-8").slice(0, 50000);
  }

  // PDF: use pdf2json
  if (mimeType === "application/pdf") {
    return new Promise((resolve) => {
      try {
        const PDFParser = require("pdf2json");
        const parser = new PDFParser();

        parser.on("pdfParser_dataReady", (data: {
          Pages?: { Texts?: { R?: { T: string }[] }[] }[];
        }) => {
          const text = (data.Pages || [])
            .map((page) =>
              (page.Texts || [])
                .map((t) => decodeURIComponent(t.R?.[0]?.T || ""))
                .join(" ")
            )
            .join("\n\n--- Page Break ---\n\n")
            .slice(0, 50000);
          resolve(text || "[PDF 无文本内容，可能为扫描件或图像型 PDF]");
        });

        parser.on("pdfParser_dataError", () => {
          resolve("[PDF 解析失败，请尝试将 PDF 内容复制为 .txt 文件后重新上传]");
        });

        parser.parseBuffer(buffer);
      } catch (e) {
        console.error("PDF parse error:", e);
        resolve("[PDF 解析失败，不支持此 PDF 格式]");
      }
    });
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
export async function searchMaterials(
  query: string,
  materials: { id: string; name: string; content: string | null }[]
): Promise<{ id: string; name: string; content: string; score: number }[]> {
  const queryEmbedding = await getEmbedding(query);

  if (queryEmbedding) {
    // Semantic search via embeddings
    const scored = await Promise.all(
      materials
        .filter((m) => m.content && m.content.length > 10)
        .map(async (m) => {
          const emb = await getEmbedding(m.content!);
          const score = emb ? cosineSimilarity(queryEmbedding, emb) : 0;
          return { id: m.id, name: m.name, content: m.content!, score };
        })
    );
    return scored
      .filter((s) => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
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
