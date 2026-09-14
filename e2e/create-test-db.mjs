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

// webServer 中的 DATABASE_URL 已被替换为实际供应用运行的测试库；建库时必须
// 从原始开发库派生一次，避免重复生成 `*_test_test`。
const devUrl =
  process.env.E2E_SOURCE_DATABASE_URL ||
  process.env.MEMFIRE_DATABASE_URL ||
  process.env.DATABASE_URL;
if (!devUrl) {
  console.log("⚠️  DATABASE_URL 未找到 — 跳过测试库创建");
  process.exit(0);
}

const testDbName = deriveTestDbName(devUrl);
// 建库仅发生在每次 E2E 启动前。直连 Neon 偶发冷启动时可能连续拒绝数次，
// 因此在有限次数内重建连接池；最终仍失败会明确阻断测试，而非误报通过。
const RETRY_DELAYS = [0, 1_500, 4_000, 8_000, 15_000];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConnectionError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P02", "57P03"].includes(code)) {
    return true;
  }
  return /connection terminated|connection timeout|network|socket hang up/i.test(
    String(error?.message || "")
  );
}

/**
 * Neon 偶发在 TLS 握手后立即关闭连接。每次重试均新建一个单连接池，
 * 不复用已终止的 client，也不会掩盖最终错误。
 */
async function queryWithRetry(connectionString, query, label) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
    if (attempt > 0) await wait(RETRY_DELAYS[attempt]);
    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 1_000,
      keepAlive: true,
    });
    try {
      return await pool.query(query);
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error)) throw error;
      if (attempt < RETRY_DELAYS.length - 1) {
        console.warn(`⚠️  ${label} 第 ${attempt + 1} 次连接失败，正在重试`);
      }
    } finally {
      await pool.end();
    }
  }
  throw lastError;
}

try {
  await queryWithRetry(devUrl, `CREATE DATABASE "${testDbName}"`, "创建测试库");
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
try {
  await queryWithRetry(
    deriveTestUrl(devUrl, testDbName),
    'CREATE EXTENSION IF NOT EXISTS "vector"',
    "启用 pgvector"
  );
  console.log(`✅ 测试库已启用 pgvector`);
} catch (err) {
  // Neon 在瞬时网络抖动时可能拒绝 DDL 连接；已有测试库可继续由后续 schema 同步/运行时验证。
  // 建库失败仍然是硬错误，但“已存在库的扩展确认”不应让整套 E2E 无法启动。
  console.warn(`⚠️  启用 pgvector 失败，沿用已有测试库: ${err?.message}`);
}
