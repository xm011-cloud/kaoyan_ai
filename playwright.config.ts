import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 加载 .env.local(Playwright 不会自动加载;剥掉双引号)
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0) {
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^"|"$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {
    // .env.local 不存在
  }
}
loadEnvLocal();

// 派生 E2E 测试库 URL:在 dev 库名后追加 "_test"
// (如 postgresql://.../neondb?... -> postgresql://.../neondb_test?...)
function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
  if (!url) return "";
  const qIdx = url.indexOf("?");
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const query = qIdx === -1 ? "" : url.slice(qIdx);
  const slash = base.lastIndexOf("/");
  const db = base.slice(slash + 1);
  return `${base.slice(0, slash + 1)}${db}_test${query}`;
}

/**
 * Neon 的直连端点适合建库与 Prisma CLI；应用在 E2E 运行期间改走 pooler，
 * 避免单个 dev server 在高频页面切换时反复建立直连 TLS 会话。
 * 非 Neon 地址保持原样，兼容本地 PostgreSQL 和 MemFire 环境。
 */
function toNeonPoolerUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split(".");
    if (
      parsed.hostname.endsWith(".neon.tech") &&
      hostParts.length > 0 &&
      !hostParts[0].endsWith("-pooler")
    ) {
      hostParts[0] = `${hostParts[0]}-pooler`;
      parsed.hostname = hostParts.join(".");
    }
    return parsed.toString();
  } catch {
    // 无法解析时沿用原连接串，让现有启动链路给出明确错误。
    return url;
  }
}

// 独立端口:避免与开发中的 :3000 dev server 冲突,并强制走测试库
const TEST_DB_URL = testDatabaseUrl();
const TEST_APP_DB_URL = toNeonPoolerUrl(TEST_DB_URL);
const SOURCE_DB_URL =
  process.env.MEMFIRE_DATABASE_URL || process.env.DATABASE_URL || "";
const TEST_PORT = 3100;
const BASE_URL = `http://localhost:${TEST_PORT}`;
export default defineConfig({
  testDir: "./e2e",
  // 全套用例共享一个认证账号和测试库；并发执行会互相争用数据并造成随机失败。
  // 保持单 worker，优先保证发布基线可复现。
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Neon 测试库偶发在 TLS 建连阶段重置连接。保留单 worker 和所有业务断言，
  // 仅对瞬态基础设施失败重试一次；CI 则给两次恢复机会。
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // 个别用例会先通过隔离库准备数据，再验证包含 6 秒取消窗口的异步交互；
  // 在 Neon 冷连接时默认 30 秒会把仍可恢复的链路误判为失败。
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 登录态只服务于 authenticated 项目。认证服务短暂不可达时，公开页与未登录保护
    // 仍可单独执行，不再被全局 setup 一并阻断。
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    // Authenticated tests (use saved storage state)
    {
      name: "authenticated",
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      testMatch: [
        "dashboard.spec.ts",
        "goal.spec.ts",
        "tasks.spec.ts",
        "checkin.spec.ts",
        "pomodoro.spec.ts",
        "materials.spec.ts",
        "chat.spec.ts",
        "practice.spec.ts",
        "wrong-questions.spec.ts",
        "feedback.spec.ts",
        "knowledge-graph.spec.ts",
        "study-path.spec.ts",
        "admission.spec.ts",
        "settings.spec.ts",
        "navigation.spec.ts",
        "suggestions.spec.ts",
        "admin.spec.ts",
        "leaderboard.spec.ts",
        "export.spec.ts",
        "profile.spec.ts",
        "skills.spec.ts",
        "ai-waiting.spec.ts",
        "ai-config.spec.ts",
        "changelog.spec.ts",
        "exam-questions.spec.ts",
        "compliance.spec.ts",
        "onboarding.spec.ts",
        "offline.spec.ts",
        "courses.spec.ts",
        "workspace-shell.spec.ts",
        "study-evidence.spec.ts",
      ],
    },
    // Unauthenticated tests (no storage state)
    {
      name: "unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: ["unauthenticated.spec.ts", "support.spec.ts"],
    },
  ],
  webServer: {
    // 每次启动:确保测试库存在 → 同步 schema(尽力而为) → 构建后跑生产 Node server。
    // 全套 150+ 用例在 Turbopack dev server 上会累积大量按页编译缓存，导致 Windows
    // 环境内存膨胀、导航被中断；E2E 验证产品行为时用 next start 更接近上线运行态。
    // 注意:本机 prisma db push(rust engine)连 Neon 端点持续 P1001(node pg 却正常)，
    // 故 db push 失败只告警不阻塞 —— app 运行时走 driver adapter(node pg)，schema 已存在即可跑。
    // webServer.env 会在建库、构建与运行三个环节统一注入测试库和 E2E 标记。
    // 不把连接串拼进 Windows 命令行，避免本机进程列表意外暴露数据库凭据。
    command: `node e2e/create-test-db.mjs && (npx prisma db push --skip-generate --accept-data-loss || echo "WARN: db push 失败(rust engine 连不上 Neon)，沿用现有测试库 schema") && npm run build && npm run start -- -p ${TEST_PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    // 链式启动包含建库、schema 同步和生产构建，Neon 冷启动时允许更长准备时间。
    timeout: 360000,
    env: TEST_APP_DB_URL
      ? {
          ...process.env,
          DATABASE_URL: TEST_APP_DB_URL,
          MEMFIRE_DATABASE_URL: TEST_APP_DB_URL,
          E2E_SOURCE_DATABASE_URL: SOURCE_DB_URL,
          E2E_TEST_MODE: "1",
        }
      : undefined,
  },
});
