import { test, expect } from "@playwright/test";

// 支持作者页（公开）：感谢墙 + 留言表单
// 注意：真实提交会写入一条待审留言（dev 库可见，公开不可见，无害）

test("support page shows wall and form", async ({ page }) => {
  await page.goto("/support");
  await expect(page.locator("text=请作者喝一杯咖啡")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: /^感谢墙/ })).toBeVisible();
  await expect(page.locator('input[id="s-name"]')).toBeVisible();
  await expect(page.locator('textarea[id="s-message"]')).toBeVisible();
});

test("support honey pot submission silently succeeds without wall entry", async ({ page }) => {
  await page.goto("/support");
  // 蜜罐字段被填 → 接口返回 ok，但不产生真实留言
  const response = await page.evaluate(() =>
    fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bot", message: "spam", honeypot: "filled" }),
    }).then((r) => r.json())
  );
  expect(response.ok).toBe(true);
});

test("support submission shows success message", async ({ page }) => {
  await page.goto("/support");
  await page.fill('input[id="s-name"]', `e2e_${Date.now()}`);
  await page.fill('textarea[id="s-message"]', "E2E 测试留言，审核后可见");
  await page.getByRole("button", { name: "提交留言" }).click();
  await expect(page.locator("text=留言已收到")).toBeVisible({ timeout: 10000 });
});
