// 清理"越界"的 AI 周计划任务（计划生成 bug 排到本周范围之外的任务）
//
// 越界定义：任务的 date 不在其 weekStartDate 声称的周 [start, start+6天] 内
//   （weekStartDate 与 date 都是 UTC 零点，时区无关）
//
// 用法：
//   node scripts/cleanup-stray-tasks.mjs          # 预演（只列出，不删除）
//   node scripts/cleanup-stray-tasks.mjs --apply  # 执行删除（跳过已完成的任务）
//
// 只处理 source=ai 的任务，绝不碰手动任务（manual/ai_confirmed）与下周正经生成的计划。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// 手动加载 .env.local（强制覆盖，避免环境里已有的占位 DATABASE_URL 干扰）
function loadEnvLocal() {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of txt.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0) {
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^"|"$/g, "");
        if (k) process.env[k] = v;
      }
    }
  } catch { /* ignore */ }
}
loadEnvLocal();

const url = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
if (!url) { console.error("缺少 DATABASE_URL"); process.exit(1); }

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const APPLY = process.argv.includes("--apply");
const IDS_ARG = process.argv.find((a) => a.startsWith("--ids="));
const IDS = IDS_ARG ? IDS_ARG.slice(6).split(",").map((s) => s.trim()).filter(Boolean) : null;
const WINDOW_MS = 90 * 86400000; // 只扫描近 90 天，避免误伤历史数据
const DAY_MS = 86400000;

async function main() {
  // 精确按 id 删除（--ids=id1,id2,..）——目标明确，只删列出的任务
  if (IDS && IDS.length > 0) {
    const targets = await prisma.task.findMany({
      where: { id: { in: IDS } },
      select: { id: true, title: true, date: true, weekStartDate: true, subject: true, source: true, completed: true },
    });
    console.log(`按 id 指定删除 ${targets.length} 条：`);
    for (const t of targets) {
      const w = t.weekStartDate?.toISOString().split("T")[0] ?? "-";
      const d = t.date.toISOString().split("T")[0];
      console.log(`  - id=${t.id} | 所属周=${w} | 任务日期=${d} | 来源=${t.source} | ${t.subject || "-"} | ${t.title}`);
    }
    const aiOnly = targets.filter((t) => t.source === "ai" && !t.completed);
    if (!APPLY) {
      console.log("预演（dry-run），未删除。加 --apply 执行。");
      return;
    }
    const del = await prisma.task.deleteMany({ where: { id: { in: aiOnly.map((t) => t.id) } } });
    console.log(`✅ 已删除 ${del.count} 条。`);
    return;
  }
  const since = new Date(Date.now() - WINDOW_MS);
  const tasks = await prisma.task.findMany({
    where: { source: "ai", weekStartDate: { gte: since } },
    select: { id: true, title: true, date: true, weekStartDate: true, subject: true, completed: true },
    orderBy: { weekStartDate: "asc" },
  });

  const strays = tasks.filter((t) => {
    const start = t.weekStartDate.getTime();
    const end = start + 6 * DAY_MS; // 本周最后一天
    const d = t.date.getTime();
    return d < start || d > end;
  });
  const completedStrays = strays.filter((s) => s.completed);

  console.log(`扫描近 90 天 AI 周计划任务 ${tasks.length} 条，越界 ${strays.length} 条：`);
  for (const s of strays) {
    const w = s.weekStartDate.toISOString().split("T")[0];
    const d = s.date.toISOString().split("T")[0];
    console.log(`  - id=${s.id} | 所属周=${w} | 任务日期=${d} | ${s.subject || "-"} | ${s.title}${s.completed ? "（已完成，跳过）" : ""}`);
  }

  if (strays.length === 0) {
    console.log("没有需要清理的越界任务。");
    return;
  }

  if (!APPLY) {
    console.log("\n这是预演（dry-run），未删除。确认无误后加 --apply 执行删除。");
    return;
  }

  // 已完成的任务不自动删（可能用户真的做了），只删未完成的
  const toDelete = strays.filter((s) => !s.completed);
  if (completedStrays.length > 0) {
    console.log(`\n⚠️ ${completedStrays.length} 条已完成越界任务跳过（不删除），请人工确认。`);
  }
  if (toDelete.length === 0) {
    console.log("没有可删除的未完成越界任务。");
    return;
  }

  const del = await prisma.task.deleteMany({ where: { id: { in: toDelete.map((s) => s.id) } } });
  console.log(`✅ 已删除 ${del.count} 条越界任务。`);
}

main()
  .catch((e) => { console.error("清理失败:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
