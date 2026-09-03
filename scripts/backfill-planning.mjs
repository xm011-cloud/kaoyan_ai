import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (apply && !args.has("--confirm-planning-backfill")) {
  throw new Error("执行回填必须同时提供 --apply --confirm-planning-backfill");
}

let connectionString = process.env.MEMFIRE_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("缺少 MEMFIRE_DATABASE_URL 或 DATABASE_URL");
if (args.has("--test-db")) {
  const queryIndex = connectionString.indexOf("?");
  const base = queryIndex === -1 ? connectionString : connectionString.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : connectionString.slice(queryIndex);
  const slash = base.lastIndexOf("/");
  const database = base.slice(slash + 1);
  connectionString = `${base.slice(0, slash + 1)}${database.endsWith("_test") ? database : `${database}_test`}${query}`;
}

const client = new pg.Client({ connectionString });

const STAGE_META = {
  "基础巩固": {
    key: "foundation",
    objective: "补齐核心基础知识，建立各科稳定学习节奏。",
    exitCriteria: ["核心基础内容完成第一轮学习", "基础练习形成可复盘记录"],
  },
  "强化提升": {
    key: "intensify",
    objective: "围绕薄弱模块和常见题型进行专题训练。",
    exitCriteria: ["主要专题完成强化训练", "薄弱项有明确改善证据"],
  },
  "冲刺突破": {
    key: "sprint",
    objective: "通过真题、模拟与限时训练提升应试表现。",
    exitCriteria: ["完成计划内真题或模拟训练", "形成稳定的考试时间分配策略"],
  },
  "查漏补缺": {
    key: "review",
    objective: "集中修补剩余短板并稳定最终状态。",
    exitCriteria: ["高频错题和遗留薄弱点完成复盘", "最终复习清单已完成"],
  },
};

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizedMonday(value) {
  const date = new Date(`${dateOnly(value)}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? 1 : day === 1 ? 0 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function stageMeta(phase, order) {
  const known = STAGE_META[phase];
  return known || {
    key: `legacy-${order + 1}`,
    objective: `完成${phase}阶段的既有里程碑。`,
    exitCriteria: [`${phase}阶段里程碑全部完成或经用户确认调整`],
  };
}

async function audit() {
  const paths = await client.query(`
    SELECT sp."id", sp."status"
    FROM "StudyPath" sp
    WHERE NOT EXISTS (
      SELECT 1 FROM "StudyPathStage" s WHERE s."studyPathId" = sp."id"
    )
  `);
  const tasks = await client.query(`
    SELECT t."id", t."userId", t."title", t."description", t."date", t."duration",
           t."phase", t."subject", t."weekStartDate", t."source", t."completed"
    FROM "Task" t
    WHERE t."weeklyPlanId" IS NULL
      AND t."weekStartDate" IS NOT NULL
      AND t."source" = 'ai'
    ORDER BY t."userId", t."weekStartDate", t."date"
  `);
  return { paths: paths.rows, tasks: tasks.rows };
}

async function backfillStages(paths) {
  let stagesCreated = 0;
  let milestonesLinked = 0;
  for (const path of paths) {
    const milestones = (await client.query(`
      SELECT * FROM "StudyPathMilestone"
      WHERE "studyPathId" = $1
      ORDER BY "order" ASC, "createdAt" ASC
    `, [path.id])).rows;
    const phases = [];
    for (const milestone of milestones) {
      if (milestone.phase && !phases.includes(milestone.phase)) phases.push(milestone.phase);
    }
    const firstIncomplete = phases.findIndex((phase) =>
      milestones.some((milestone) => milestone.phase === phase && !milestone.completedAt && Number(milestone.progress) < 1),
    );
    for (let order = 0; order < phases.length; order++) {
      const phase = phases[order];
      const meta = stageMeta(phase, order);
      const id = randomUUID();
      let status = "pending";
      if (firstIncomplete === -1) status = "completed";
      else if (order < firstIncomplete) status = "completed";
      else if (order === firstIncomplete && path.status === "active") status = "active";
      await client.query(`
        INSERT INTO "StudyPathStage"
          ("id", "studyPathId", "key", "title", "order", "objective", "exitCriteria", "status", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW(),NOW())
      `, [id, path.id, meta.key, phase, order, meta.objective, JSON.stringify(meta.exitCriteria), status]);
      const linked = await client.query(`
        UPDATE "StudyPathMilestone" SET "stageId" = $1
        WHERE "studyPathId" = $2 AND "phase" = $3 AND "stageId" IS NULL
      `, [id, path.id, phase]);
      stagesCreated++;
      milestonesLinked += linked.rowCount || 0;
    }
  }
  return { stagesCreated, milestonesLinked };
}

async function backfillWeeklyPlans(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const weekStart = normalizedMonday(task.weekStartDate);
    const key = `${task.userId}|${weekStart}`;
    groups.set(key, [...(groups.get(key) || []), task]);
  }

  let plansCreated = 0;
  let tasksLinked = 0;
  for (const [key, group] of groups) {
    const [userId, weekStart] = key.split("|");
    const latest = await client.query(`
      SELECT COALESCE(MAX("version"), 0) AS "version"
      FROM "WeeklyPlan" WHERE "userId" = $1 AND "weekStart" = $2::date
    `, [userId, weekStart]);
    const version = Number(latest.rows[0].version) + 1;
    const planId = randomUUID();
    const weekEnd = new Date(`${weekStart}T00:00:00.000Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const items = group.map((task) => ({
      title: task.title,
      description: task.description,
      date: dateOnly(task.date),
      duration: task.duration,
      phase: task.phase,
      subject: task.subject,
    }));
    const plannedMinutes = group.reduce((sum, task) => sum + (task.duration || 0), 0);
    await client.query(`
      INSERT INTO "WeeklyPlan"
        ("id", "userId", "weekStart", "weekEnd", "version", "status", "objective", "rationale",
         "successCriteria", "plannedMinutes", "items", "generatedBy", "createdAt", "updatedAt")
      VALUES ($1,$2,$3::date,$4::date,$5,'archived',$6,$7,$8::jsonb,$9,$10::jsonb,'local',NOW(),NOW())
    `, [
      planId, userId, weekStart, weekEnd.toISOString().slice(0, 10), version,
      "历史 AI 周任务归档", "由可信的旧 AI 任务批次保守回填；不代表用户重新确认。",
      JSON.stringify(["仅用于历史追溯，不自动恢复为活动计划"]), plannedMinutes, JSON.stringify(items),
    ]);
    const ids = group.map((task) => task.id);
    const linked = await client.query(`
      UPDATE "Task" SET "weeklyPlanId" = $1
      WHERE "id" = ANY($2::text[]) AND "weeklyPlanId" IS NULL
    `, [planId, ids]);
    plansCreated++;
    tasksLinked += linked.rowCount || 0;
  }
  return { plansCreated, tasksLinked };
}

try {
  await client.connect();
  const audited = await audit();
  const groups = new Set(audited.tasks.map((task) => `${task.userId}|${normalizedMonday(task.weekStartDate)}`));
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    pathsWithoutStages: audited.paths.length,
    eligibleLegacyAiTasks: audited.tasks.length,
    eligibleWeeklyPlanGroups: groups.size,
  }, null, 2));

  if (apply) {
    await client.query("BEGIN");
    const stageResult = await backfillStages(audited.paths);
    const weeklyResult = await backfillWeeklyPlans(audited.tasks);
    await client.query("COMMIT");
    console.log(JSON.stringify({ applied: true, ...stageResult, ...weeklyResult }, null, 2));
  } else {
    console.log("Dry-run 完成：未写入数据库。确认备份与审计结果后，使用 --apply --confirm-planning-backfill 执行。 ");
  }
} catch (error) {
  if (apply) await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
