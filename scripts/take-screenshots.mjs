/**
 * 生成 README / 推广用截图（登录态：e2e/.auth/user.json）
 * 用法：先起 dev server（:3100），再 node scripts/take-screenshots.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SCREENSHOT_BASE || "http://localhost:3100";
const OUT = resolve("screenshots");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // 高清图（发帖/README 用）
  storageState: "e2e/.auth/user.json",
});
const page = await ctx.newPage();

const shots = [
  { name: "dashboard", path: "/dashboard", wait: "text=学习概览" },
  { name: "admission", path: "/admission", wait: "text=院校" },
  { name: "skills", path: "/skills", wait: "text=我的技能" },
  { name: "practice", path: "/practice", wait: "text=练习" },
  { name: "wrong-questions", path: "/wrong-questions", wait: "text=错题" },
  { name: "chat", path: "/chat", wait: "text=AI 对话" },
  { name: "checkin", path: "/checkin", wait: "text=打卡" },
  { name: "landing", path: "/", wait: "text=AI 考研助手" },
];

for (const s of shots) {
  try {
    await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle", timeout: 60000 });
    // 等关键元素（最多 15s）
    try {
      await page.locator(s.wait).first().waitFor({ timeout: 15000 });
    } catch {
      console.warn(`⚠️  未等到元素 ${s.wait} 于 ${s.path}`);
    }
    await page.waitForTimeout(1200); // 等动画/数据渲染
    await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
    console.log(`✅ ${s.name}.png`);
  } catch (e) {
    console.error(`❌ ${s.name}: ${e.message?.split("\n")[0]}`);
  }
}

// 院校页特殊：搜索一次真实数据（Tavily）让截图有内容
try {
  await page.goto(`${BASE}/admission`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[placeholder*="院校名称"]').fill("清华大学");
  await page.locator('input[placeholder*="专业"]').fill("计算机");
  await page.getByRole("button", { name: /搜索院校信息/ }).click();
  await page.waitForTimeout(60000); // 真实搜索 + AI 提取较慢
  await page.screenshot({ path: `${OUT}/admission-result.png`, fullPage: false });
  console.log("✅ admission-result.png");
} catch (e) {
  console.error("❌ admission-result:", e.message?.split("\n")[0]);
}

await browser.close();
console.log("完成。输出目录:", OUT);
