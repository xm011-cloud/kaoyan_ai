import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parseAdmissionSeedText, type SeedRowInput } from "@/lib/admission";

/**
 * POST /api/admin/admission-seed — 管理端批量导入院校数据（全局共享，verifyStatus=verified）。
 * body: { text: string } 粘贴多行（见 parseAdmissionSeedText），或 { rows: SeedRowInput[] }。
 * 同源(校/专/年/类/source)去重，跳过已存在。
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    let rows: SeedRowInput[];
    if (typeof body.text === "string") {
      rows = parseAdmissionSeedText(body.text);
    } else if (Array.isArray(body.rows)) {
      rows = body.rows as SeedRowInput[];
    } else {
      return jsonNoStore({ error: "格式错误：需要 text 或 rows" }, { status: 400 });
    }
    if (rows.length === 0) {
      return jsonNoStore({ error: "没有可导入的行（检查格式）" }, { status: 400 });
    }

    let saved = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const r of rows) {
      if (!r.university || !r.major || !r.year || !r.category) {
        errors.push(`${r.university || "?"}/${r.major || "?"}/${r.year ?? "?"}: 字段不完整`);
        continue;
      }
      const exists = await prisma.admissionInfo.findFirst({
        where: {
          university: r.university,
          major: r.major,
          year: r.year,
          category: r.category,
          source: r.source || "",
        },
      });
      if (exists) {
        skipped++;
        continue;
      }
      try {
        await prisma.admissionInfo.create({
          data: {
            userId: null, // 全局共享
            university: r.university,
            major: r.major,
            year: r.year,
            category: r.category,
            data: (r.data || {}) as Prisma.InputJsonValue,
            source: r.source || "admin-import",
            verifyStatus: "verified", // admin 导入 = 可信
          },
        });
        saved++;
      } catch (e) {
        errors.push(`${r.university}/${r.major}/${r.year}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return jsonNoStore({ saved, skipped, errors, total: rows.length });
  } catch (err) {
    return handleApiError(err, "导入院校数据");
  }
}
