import { test, expect } from "@playwright/test";

// 作者管理后台：e2e 账号（test2@example.com）不是 ADMIN_EMAIL → 应显示"无权限"
// （fail closed：未配置或非管理员一律拒绝）

test("admin page shows no-permission for non-admin user", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("text=无权限")).toBeVisible({ timeout: 10000 });
});

test("admin API returns 403 for non-admin user", async ({ page }) => {
  const response = await page.request.get("/api/admin/support");
  expect(response.status()).toBe(403);
});

test("admin reset-link API returns 403 for non-admin user", async ({ page }) => {
  const response = await page.request.post("/api/admin/users/reset-link", {
    data: { email: "test@example.com" },
  });
  expect(response.status()).toBe(403);
});
