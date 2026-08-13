import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { ensureTemplatesSeeded, getNoteSummary } from "@/lib/skills";

// GET: 当前用户的技能列表（首次访问惰性播种 3 个模板）
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    await ensureTemplatesSeeded(user!.id);

    const skills = await prisma.skill.findMany({
      where: { userId: user!.id },
      orderBy: [{ createdAt: "asc" }],
    });

    const list = skills.map((s) => {
      let keywords: string[] = [];
      try {
        const parsed = JSON.parse(s.triggerKeywords);
        if (Array.isArray(parsed)) keywords = parsed.filter((k) => typeof k === "string");
      } catch {
        // ignore
      }
      const note = getNoteSummary(s.note);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        triggerKeywords: keywords,
        usageCount: s.usageCount,
        source: s.source,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        noteCount: note.count,
        noteLastLabel: note.lastLabel ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return jsonNoStore({ skills: list });
  } catch (err) {
    return handleApiError(err, "获取技能列表");
  }
}

// POST: 创建技能（来自对话蒸馏预览确认，或手动）
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return jsonNoStore({ error: "技能名称不能为空" }, { status: 400 });
    }
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return jsonNoStore({ error: "技能流程不能为空" }, { status: 400 });
    }

    const existing = await prisma.skill.findFirst({ where: { userId: user!.id, name } });
    if (existing) {
      return jsonNoStore({ error: "已有同名技能，请换个名字或直接编辑它" }, { status: 409 });
    }

    const skill = await prisma.skill.create({
      data: {
        userId: user!.id,
        name: name.slice(0, 40),
        description: typeof body.description === "string" ? body.description.slice(0, 200) : null,
        icon: typeof body.icon === "string" && body.icon ? body.icon.slice(0, 8) : "⚡",
        triggerKeywords: JSON.stringify(
          Array.isArray(body.triggerKeywords)
            ? body.triggerKeywords.filter((k: unknown) => typeof k === "string").slice(0, 20)
            : []
        ),
        steps: body.steps.slice(0, 20) as unknown as object,
        note: {},
        source: body.source === "template" ? "template" : "user",
      },
    });

    return jsonNoStore({ skill: { id: skill.id, name: skill.name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "创建技能");
  }
}
