import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig } from "@/lib/ai-config";
import { createServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/rag";

interface AdmissionEntry {
  university: string;
  major: string;
  year: number;
  category: string; // "score_line" | "enrollment" | "subjects" | "tuition" | "notes"
  data: Record<string, unknown>;
  source?: string;
}

// AI 提取 admission 结构化数据
async function extractWithAI(
  text: string,
  userId: string,
  hints: { university?: string; major?: string; year?: number }
): Promise<AdmissionEntry[]> {
  const aiConfig = await getUserAiConfig(userId);
  if (!aiConfig) {
    throw new Error("NO_AI_CONFIG");
  }

  const hintText = [
    hints.university && `- 院校: ${hints.university}`,
    hints.major && `- 专业: ${hints.major}`,
    hints.year && `- 年份: ${hints.year}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `请从以下文本中提取考研录取信息。

## 用户提示
${hintText || "从文本中推断院校、专业、年份"}

## 文本内容
${text.slice(0, 10000)}

## 输出格式（只返回JSON对象，不要markdown代码块）
{
  "university": "院校名称",
  "major": "专业名称",
  "entries": [
    {
      "year": 2025,
      "category": "score_line",
      "data": {
        "scores": { "总分": 350, "政治": 60, "英语": 60, "数学": 90, "专业课": 140 },
        "notes": "备注信息"
      },
      "source": "用户上传"
    },
    {
      "year": 2025,
      "category": "enrollment",
      "data": {
        "enrollmentQuota": 50,
        "applicants": 300,
        "notes": "招生人数说明"
      },
      "source": "用户上传"
    },
    {
      "year": 2025,
      "category": "subjects",
      "data": {
        "subjects": ["政治", "英语一", "数学一", "408计算机学科专业基础综合"],
        "notes": "考试科目说明"
      },
      "source": "用户上传"
    }
  ]
}

## 规则
1. 字段不存在就填 null，不准编造数据
2. 每条数据标注来源为"用户上传"
3. category 只能是: score_line(分数线), enrollment(招生人数), subjects(考试科目), tuition(学费), notes(其他)
4. 如果文本包含多个年份的数据，每个年份分别生成 entry`;

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
            "你是一个考研数据提取专家。你只返回JSON，不返回其他内容。从用户提供的文本中提取结构化的考研录取数据。字段不存在就填null，不准编造数据。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI import extraction error:", errText.substring(0, 300));
    throw new Error("AI_UPSTREAM_ERROR");
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "";
  // fallback: 推理模型 reasoning_content
  if (!content) {
    content = data.choices?.[0]?.message?.reasoning_content || "";
  }

  // 提取 JSON
  content = content.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("AI import: no JSON found in response, first 300:", content.substring(0, 300));
    throw new Error("AI_PARSE_ERROR");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const university = parsed.university || hints.university || "未知院校";
  const major = parsed.major || hints.major || "未知专业";
  const entries: Record<string, unknown>[] = parsed.entries || [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  return entries.map((entry) => ({
    university,
    major,
    year: typeof entry.year === "number" ? entry.year : hints.year || new Date().getFullYear(),
    category: ["score_line", "enrollment", "subjects", "tuition", "notes"].includes(
      entry.category as string
    )
      ? (entry.category as string)
      : "notes",
    data: (entry.data as Record<string, unknown>) || {},
    source: (entry.source as string) || "用户上传",
  }));
}

// upsert 批量保存
async function upsertEntries(userId: string, entries: AdmissionEntry[]) {
  const saved: AdmissionEntry[] = [];
  for (const entry of entries) {
    try {
      await prisma.admissionInfo.upsert({
        where: {
          university_major_year_category: {
            university: entry.university,
            major: entry.major,
            year: entry.year,
            category: entry.category,
          },
        },
        create: {
          userId,
          university: entry.university,
          major: entry.major,
          year: entry.year,
          category: entry.category,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: entry.data as any,
          source: entry.source || "用户上传",
        },
        update: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: entry.data as any,
          source: entry.source || "用户上传",
        },
      });
      saved.push(entry);
    } catch (e) {
      console.error("Upsert admission entry failed:", e);
    }
  }
  return saved;
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const contentType = request.headers.get("content-type") || "";

    // ── 模式 A: 文件上传 (multipart/form-data) ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const university = (formData.get("university") as string) || undefined;
      const major = (formData.get("major") as string) || undefined;
      const yearStr = formData.get("year") as string;
      const year = yearStr ? parseInt(yearStr) : undefined;

      if (!file) {
        return NextResponse.json(
          { error: "请选择要上传的文件" },
          { status: 400 }
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: "文件大小不能超过 20MB" },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // 上传到 Supabase Storage（失败时降级）
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `${user!.id}/admission_imports/${timestamp}_${safeName}`;

      let storedPath = `local:${filePath}`;
      try {
        const supabase = createServiceClient();
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketName = "admission-imports";
        if (!buckets?.find((b) => b.name === bucketName)) {
          await supabase.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 20971520,
          });
        }
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true,
          });
        if (!uploadError) {
          storedPath = filePath;
        }
      } catch {
        // storage unavailable, use local fallback
      }

      // 提取文本
      const extractedText = await extractText(buffer, file.type);

      // 检测是否有可提取的文本
      if (!extractedText || /^\[.*无法.*提取.*文本/i.test(extractedText)) {
        return NextResponse.json(
          {
            error: "无法从此文件中提取文本，请将内容保存为 .txt 文件后重试",
            rawText: extractedText || "",
          },
          { status: 422 }
        );
      }

      // AI 提取
      let entries: AdmissionEntry[];
      try {
        entries = await extractWithAI(extractedText, user!.id, {
          university,
          major,
          year,
        });
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        if (msg === "NO_AI_CONFIG") {
          return NextResponse.json(
            { error: "请先在设置中配置 AI 服务" },
            { status: 400 }
          );
        }
        console.error("AI extraction for file import failed:", msg);
        return NextResponse.json({
          saved: 0,
          entries: [],
          rawText: extractedText.slice(0, 2000),
          error:
            msg === "AI_PARSE_ERROR"
              ? "AI 返回格式异常，请尝试粘贴 JSON 格式手动输入"
              : "AI 提取失败，请重试或使用 JSON 格式手动输入",
        });
      }

      if (entries.length === 0) {
        return NextResponse.json({
          saved: 0,
          entries: [],
          rawText: extractedText.slice(0, 2000),
          message: "AI 未能从文件中提取到有效的录取数据，请尝试粘贴 JSON 格式手动输入",
        });
      }

      const saved = await upsertEntries(user!.id, entries);
      return NextResponse.json({
        saved: saved.length,
        entries,
        filePath: storedPath,
      });
    }

    // ── 模式 B: 文本/JSON (application/json) ──
    const body = await request.json();
    const text = body.text as string | undefined;
    const entries = body.entries as AdmissionEntry[] | undefined;
    const autoSave = body.autoSave === true;
    const university = body.university as string | undefined;
    const major = body.major as string | undefined;
    const year = body.year as number | undefined;

    // 直接 JSON 条目导入
    if (entries && Array.isArray(entries) && entries.length > 0) {
      const valid = entries.filter(
        (e) =>
          e.university &&
          e.major &&
          typeof e.year === "number" &&
          e.category &&
          e.data
      );
      if (valid.length === 0) {
        return NextResponse.json(
          { error: "没有有效的条目，每条需包含 university, major, year, category, data" },
          { status: 400 }
        );
      }
      const saved = await upsertEntries(user!.id, valid);
      return NextResponse.json({ saved: saved.length, entries: saved });
    }

    // 文本粘贴 → AI 提取
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "请上传文件或粘贴文本内容" },
        { status: 400 }
      );
    }

    let extracted: AdmissionEntry[];
    try {
      extracted = await extractWithAI(text, user!.id, {
        university,
        major,
        year,
      });
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      if (msg === "NO_AI_CONFIG") {
        return NextResponse.json(
          { error: "请先在设置中配置 AI 服务" },
          { status: 400 }
        );
      }
      console.error("AI extraction for text import failed:", msg);
      return NextResponse.json({
        saved: 0,
        entries: [],
        rawText: text.slice(0, 2000),
        error:
          msg === "AI_PARSE_ERROR"
            ? "AI 返回格式异常，请尝试粘贴 JSON 格式手动输入"
            : "AI 提取失败，请重试或使用 JSON 格式手动输入",
      });
    }

    if (extracted.length === 0) {
      return NextResponse.json({
        saved: 0,
        entries: [],
        message: "AI 未能提取到有效的录取数据，请尝试粘贴 JSON 格式手动输入",
      });
    }

    const saved = autoSave
      ? await upsertEntries(user!.id, extracted)
      : extracted;
    return NextResponse.json({
      saved: Array.isArray(saved) ? saved.length : 0,
      entries: autoSave ? saved : extracted,
      autoSaved: autoSave,
    });
  } catch (err) {
    console.error("Admission import error:", err);
    return NextResponse.json(
      { error: "导入失败，请稍后再试" },
      { status: 500 }
    );
  }
}
