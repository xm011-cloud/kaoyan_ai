import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";
import { searchWeb, fetchPageContent } from "@/lib/search";

// POST: 联网搜索并导入真题
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { subject, year, keywords, count = 5 } = body;

    if (!subject) {
      return NextResponse.json({ error: "请选择科目" }, { status: 400 });
    }

    // Build search query
    const yearStr = year ? `${year}年` : "";
    const keywordStr = keywords ? ` ${keywords}` : "";
    const query = `${yearStr} ${subject} 考研真题${keywordStr} 答案 解析`;

    // Search the web
    const searchResults = await searchWeb(query, 8);

    // Fetch page content for top results
    const contents: { url: string; sourceName: string; text: string }[] = [];
    for (const r of searchResults.slice(0, 5)) {
      const text = await fetchPageContent(r.url);
      if (text && text.length > 100) {
        contents.push({
          url: r.url,
          sourceName: r.title,
          text: text.slice(0, 5000),
        });
      }
    }

    if (contents.length === 0) {
      return NextResponse.json(
        { error: "未找到相关内容，请尝试更换搜索词" },
        { status: 404 }
      );
    }

    // Use AI to extract questions
    const aiConfig = await getUserAiConfig(user!.id);
    let questions: {
      subject: string;
      year: number;
      source: string;
      sourceName: string;
      question: string;
      type: string;
      options?: string[];
      answer: string;
      explanation: string;
      tags: string[];
    }[] = [];

    if (aiConfig) {
      try {
        const webContext = contents
          .map((c) => `[来源: ${c.sourceName}]\nURL: ${c.url}\n${c.text}`)
          .join("\n\n===\n\n");

        const response = await fetch(`${aiConfig.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: aiConfig.model,
            messages: [
              {
                role: "system",
                content:
                  "你是考研真题提取专家。从网页内容中提取真实的考研真题。每道题标注来源URL。只返回JSON数组。",
              },
              {
                role: "user",
                content: `请从以下网页内容中提取${subject}考研真题。

要求：
1. 提取 ${count} 道真题
2. **标注数据年份和来源URL**（如果内容中有年份信息，提取真实年份；否则标注原页面中提到的年份或填 null）
3. 每道题包含：question（题目）、type（choice/essay）、options（选择题选项数组）、answer（正确答案）、explanation（解析）、tags（知识点标签数组）
4. **不要编造题目**——如果内容中题目不完整或没有明确答案，跳过
5. **保留原文中的真实题目文本，不要改写**

## 网页内容
${webContext.slice(0, 10000)}

## 输出格式（只返回JSON数组）
[{"question":"...","type":"choice","options":["A...","B..."],"answer":"B","explanation":"...","tags":["知识点1","知识点2"]}]`,
              },
            ],
            temperature: 0.4,
            max_tokens: 8192,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            questions = parsed.map(
              (q: Record<string, unknown>, i: number) => ({
                subject,
                year: year || new Date().getFullYear(),
                source: contents[i % contents.length]?.url || "",
                sourceName:
                  contents[i % contents.length]?.sourceName || "",
                question: String(q.question || ""),
                type: String(q.type || "choice"),
                options: q.options as string[] | undefined,
                answer: String(q.answer || ""),
                explanation: String(q.explanation || ""),
                tags: (q.tags as string[]) || [subject],
              })
            );
          }
        }
      } catch {
        // AI extraction failed
      }
    } else {
      return NextResponse.json(
        { error: "请先在设置中配置 AI 服务，才能智能提取题目", questions: [], totalImported: 0 },
        { status: 400 }
      );
    }

    // Save to DB
    const saved: typeof questions = [];
    for (const q of questions) {
      if (!q.question || !q.answer) continue;
      try {
        const record = await prisma.importedQuestion.create({
          data: {
            userId: user!.id,
            subject: q.subject,
            year: q.year,
            source: q.source,
            sourceName: q.sourceName || null,
            question: q.question.slice(0, 5000),
            type: q.type,
            options: q.options || undefined,
            answer: q.answer.slice(0, 5000),
            explanation: q.explanation.slice(0, 5000),
            tags: q.tags,
          },
        });
        saved.push({
          ...q,
          subject: record.subject,
          year: record.year,
          source: record.source,
          sourceName: record.sourceName || "",
        });
      } catch {
        // skip duplicates
      }
    }

    return NextResponse.json({
      questions: saved,
      totalImported: saved.length,
      sources: contents.map((c) => c.url),
      disclaimer: "题目来源于网络搜索，请验证答案的准确性。标注年份可能不完全准确，仅供参考。",
    });
  } catch (err) {
    console.error("Question import error:", err);
    return NextResponse.json({ error: "导入失败" }, { status: 500 });
  }
}
