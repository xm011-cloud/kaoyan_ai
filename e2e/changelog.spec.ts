import { test, expect } from "@playwright/test";

// 更新日志页 + dashboard 更新告示 + 产品教练模板播种（已登录）

test.describe("更新日志与告示", () => {
  test("changelog page renders entries", async ({ page }) => {
    await page.goto("/changelog");
    await expect(page.locator("h1").filter({ hasText: "更新日志" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("AI 改为自备 Key 模式")).toBeVisible();
    await expect(page.getByText("院校情报正式启用")).toBeVisible();
    await expect(page.getByText("AI 技能系统上线")).toBeVisible();
  });

  test("nav settings group includes 更新日志 entry", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /考研助手/ }).first().click();
    // 用文本过滤：避免匹配 banner 的「查看更新」链接（同 href /changelog）
    await expect(page.locator('a[href="/changelog"]').filter({ hasText: "更新日志" })).toBeVisible({ timeout: 10000 });
  });

  test("dashboard shows changelog banner when unread, dismiss hides it", async ({ page }) => {
    await page.goto("/dashboard");
    // 未读（lastSeenChangelog 为空）→ 告示可见（最新条目）
    await expect(page.getByText(/新更新：开放注册/)).toBeVisible({ timeout: 20000 });
    // 关闭 → 告示消失（已读）
    await page.getByRole("button", { name: "关闭更新告示" }).click();
    await expect(page.getByText(/新更新：/)).toHaveCount(0, { timeout: 5000 });
  });

  test("dashboard banner stays hidden after being read (persisted)", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/新更新：开放注册/)).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "关闭更新告示" }).click();
    await page.reload();
    await expect(page.getByText(/新更新：/)).toHaveCount(0, { timeout: 10000 });
  });

  test("skills page seeds 产品教练 template for existing users", async ({ page }) => {
    await page.goto("/skills");
    await expect(page.getByText("产品教练", { exact: true }).first()).toBeVisible({ timeout: 20000 });
  });
});
