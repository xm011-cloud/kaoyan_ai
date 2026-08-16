import { chromium, type FullConfig } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Load .env.local into process.env (Playwright doesn't do this automatically).
 */
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // .env.local doesn't exist
  }
}

/**
 * 下周周一（本地 YYYY-MM-DD）— 与 WeeklyPlanReminder 的 nmNav 计算一致：
 * getWeekStart(今天) 回到本地周一 → +7 天 → toLocalDate。
 * 用来预置 localStorage 防打扰 key，保证 E2E 无论哪天跑都不弹周计划提醒。
 */
function nextMondayLocal(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // startOfDay
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 同 getWeekStart
  start.setDate(start.getDate() + diff + 7); // 下周周一
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Global setup: logs in via the UI and saves storage state
 * so all authenticated tests can reuse the session.
 */
async function globalSetup(config: FullConfig) {
  loadEnvLocal();
  const email = process.env.E2E_TEST_USER;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      "⚠️  E2E_TEST_USER / E2E_TEST_PASSWORD not set — skipping authenticated tests"
    );
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    // Fill in credentials and submit
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole("button", { name: /登录|登入|sign.?in/i }).click();

    // Wait for redirect to dashboard (or any authenticated page)
    await page.waitForURL(/\/(dashboard|goal|tasks)/, { timeout: 15000 });

    // 触发 ensureLocalUser:在隔离的测试库里写入 User 行(首个认证 API 调用即自动 upsert)
    try {
      await page.request.get(`${baseURL}/api/goal`);
    } catch {
      // 非致命 — 后续测试遇到真实 API 时也会触发
    }

    // 预置周计划提醒防打扰 key（与 WeeklyPlanReminder 的 STORAGE_KEY + 下周周一计算一致）。
    // 避免周日跑 E2E 时「本周告一段落」弹窗（aria-modal）遮挡页面导致 UI 断言失败。
    try {
      await page.evaluate((nm) => localStorage.setItem("weeklyPlanPrompted", nm), nextMondayLocal());
    } catch {
      // 非致命 — 周日弹窗最多遮挡个别断言，不至于整体不可用
    }

    // Save storage state (cookies + localStorage)
    await page.context().storageState({ path: "e2e/.auth/user.json" });
    console.log("✅ Auth state saved to e2e/.auth/user.json");
  } catch (err) {
    console.error("❌ Global setup failed:", err);
    // Don't throw — let tests fail individually so we can see which ones
  } finally {
    await browser.close();
  }
}

export default globalSetup;
