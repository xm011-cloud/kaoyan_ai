import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST: 批量导入错题
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();

    // Support two formats:
    // 1. { questions: [{ subject, question, answer, tags?, source? }] }
    // 2. { text: "--- delimited text ---" }
    let items: Array<{
      subject: string;
      question: string;
      answer: string;
      tags?: string[];
      source?: string;
    }> = [];

    if (body.questions && Array.isArray(body.questions)) {
      items = body.questions;
    } else if (body.text && typeof body.text === "string") {
      // Parse text format: "---" separated, each block has "科目:" "题目:" "答案:" "标签:" lines
      const blocks = body.text.split(/\n---+\n|\n---+\r?\n/).filter(Boolean);
      for (const block of blocks) {
        const lines = block.trim().split("\n");
        const item: {
          subject: string;
          question: string;
          answer: string;
          tags: string[];
        } = { subject: "", question: "", answer: "", tags: [] };
        let currentField: "subject" | "question" | "answer" | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (/^科目[：:]/.test(trimmed)) {
            item.subject = trimmed.replace(/^科目[：:]\s*/, "");
            currentField = null;
          } else if (/^题目[：:]/.test(trimmed)) {
            item.question = trimmed.replace(/^题目[：:]\s*/, "");
            currentField = "question";
          } else if (/^答案[：:]/.test(trimmed)) {
            item.answer = trimmed.replace(/^答案[：:]\s*/, "");
            currentField = "answer";
          } else if (/^解析[：:]/.test(trimmed)) {
            item.answer += (item.answer ? "\n" : "") + trimmed.replace(/^解析[：:]\s*/, "");
            currentField = "answer";
          } else if (/^标签[：:]/.test(trimmed)) {
            item.tags = trimmed
              .replace(/^标签[：:]\s*/, "")
              .split(/[,，]/)
              .map((t: string) => t.trim())
              .filter(Boolean);
            currentField = null;
          } else if (currentField === "question") {
            item.question += "\n" + trimmed;
          } else if (currentField === "answer") {
            item.answer += "\n" + trimmed;
          }
        }

        if (item.subject && item.question && item.answer) {
          items.push(item);
        }
      }
    }

    if (items.length === 0) {
      return jsonNoStore(
        { error: "没有有效的题目数据" },
        { status: 400 }
      );
    }

    const created = await Promise.all(
      items.map((item) =>
        prisma.wrongQuestion.create({
          data: {
            userId: user!.id,
            subject: item.subject,
            question: item.question.slice(0, 5000),
            answer: item.answer.slice(0, 5000),
            source: item.source || "manual",
            tags: item.tags || [],
          },
        })
      )
    );

    return jsonNoStore({
      success: true,
      count: created.length,
      questions: created,
    });
  } catch (err) {
    console.error("Batch import wrong-questions error:", err);
    return jsonNoStore({ error: "批量导入失败" }, { status: 500 });
  }
}
