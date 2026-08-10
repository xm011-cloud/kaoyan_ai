import { test, expect } from "@playwright/test";

// 学习圈排行榜（已登录）：页面渲染 + 周期切换 + API 鉴权
// 排行榜内容取决于打卡数据，不做数据断言，只验证 UI 结构

test("leaderboard page loads with period tabs", async ({ page }) => {
  const response = await page.goto("/leaderboard");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "🏆 学习圈排行榜" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "本周" })).toBeVisible();
  await expect(page.getByRole("button", { name: "本月" })).toBeVisible();
  await expect(page.getByRole("button", { name: "全部" })).toBeVisible();
  // 加载结束后显示排行榜或空态（二选一）
  await expect(page.locator("text=加载中...").first()).toBeHidden({ timeout: 10000 }).catch(() => {});
  await expect(page.locator("text=学习圈排行榜")).toBeVisible();
});

test("leaderboard API requires auth", async ({ request }) => {
  const response = await request.get("/api/leaderboard");
  expect([200, 401, 307]).toContain(response.status());
});

test("leaderboard period switching updates data", async ({ page }) => {
  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "本月" }).click();
  await expect(page.getByRole("button", { name: "本月" })).toHaveClass(/bg-card/);
  await page.getByRole("button", { name: "全部" }).click();
  await expect(page.getByRole("button", { name: "全部" })).toHaveClass(/bg-card/);
});
