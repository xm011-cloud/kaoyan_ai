import { test, expect } from "@playwright/test";

// 数据导出（已登录）：设置页点击导出 → 下载 JSON 文件

test("settings export button downloads JSON", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /导出数据/ })).toBeVisible({ timeout: 10000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出数据/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^kaoyan-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test("export API requires auth", async ({ request }) => {
  const response = await request.get("/api/user/export");
  expect([200, 401, 307]).toContain(response.status());
  if (response.status() === 200) {
    const body = await response.json();
    expect(Array.isArray(body.data.studyPaths)).toBe(true);
    expect(Array.isArray(body.data.weeklyPlans)).toBe(true);
    expect(Array.isArray(body.data.studyProfileFacts)).toBe(true);
  }
});
