// 创建 E2E 独立测试数据库(幂等)。
// 在 dev DATABASE_URL 的库名后追加 "_test",然后用 dev 连接建库。
// 可被 playwright webServer 命令链每次调用:已存在则跳过,不存在则创建。
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 加载 .env.local(Playwright 不会自动加载)
try {
  const content = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) {
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      // 剥掉 .env 里的双引号(.env.local 的 DATABASE_URL 是带引号的)
      if (!process.env[k]) process.env[k] = v.replace(/^"|"$/g, "");
    }
  }
} catch {
  // .env.local 不存在
}

function deriveTestDbName(url) {
  const qIdx = url.indexOf("?");
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const slash = base.lastIndexOf("/");
  return `${base.slice(slash + 1)}_test`;
}

const devUrl = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
if (!devUrl) {
  console.log("⚠️  DATABASE_URL 未找到 — 跳过测试库创建");
  process.exit(0);
}

const testDbName = deriveTestDbName(devUrl);
const pool = new Pool({ connectionString: devUrl, connectionTimeoutMillis: 10000 });

try {
  await pool.query(`CREATE DATABASE "${testDbName}"`);
  console.log(`✅ 已创建测试库 "${testDbName}"`);
} catch (err) {
  if (err?.code === "42P04") {
    console.log(`ℹ️  测试库 "${testDbName}" 已存在,跳过`);
  } else {
    console.error(`❌ 创建测试库失败: ${err?.message}`);
    process.exitCode = 1;
  }
}

// 启用 pgvector(schema 的 knowledgeNode.embedding 使用 vector 类型)
function deriveTestUrl(url, dbName) {
  const qIdx = url.indexOf("?");
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const query = qIdx === -1 ? "" : url.slice(qIdx);
  const slash = base.lastIndexOf("/");
  return `${base.slice(0, slash + 1)}${dbName}${query}`;
}
const testPool = new Pool({
  connectionString: deriveTestUrl(devUrl, testDbName),
  connectionTimeoutMillis: 10000,
});
try {
  await testPool.query('CREATE EXTENSION IF NOT EXISTS "vector"');
  console.log(`✅ 测试库已启用 pgvector`);
} catch (err) {
  console.error(`❌ 启用 pgvector 失败: ${err?.message}`);
  process.exitCode = 1;
} finally {
  await testPool.end();
  await pool.end();
}
