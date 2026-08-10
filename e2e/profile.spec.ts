import { test, expect } from "@playwright/test";

// 个人资料（已登录）：昵称编辑 + 头像上传 + 公开资料页
// 头像用内联 1×1 PNG buffer，免夹具文件

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test("profile loads and nickname can be saved", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "个人资料" })).toBeVisible({ timeout: 10000 });
  await page.locator('input[maxlength="30"]').fill("测试昵称");
  await page.getByRole("button", { name: /保存/ }).click();
  await expect(page.locator("text=✅ 已保存").first()).toBeVisible({ timeout: 5000 });
});

test("avatar uploads via inline buffer", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "个人资料" })).toBeVisible({ timeout: 10000 });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG_1x1 });
  await expect(page.locator("text=✅ 已保存").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('img[alt]').first()).toBeVisible({ timeout: 5000 });
});

test("public profile page renders for self without email", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "个人资料" })).toBeVisible({ timeout: 10000 });
  const id = await page.evaluate(async () =>
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => d.id)
  );
  await page.goto(`/user/${id}`);
  await expect(page.locator("text=累计打卡").first()).toBeVisible({ timeout: 10000 });
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("@example.com");
});
