import { expect, test } from "@playwright/test";

test.describe("AI 工作区入口", () => {
  test("桌面端旧 /chat 链接会打开工作台中的 AI 协作区", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chat?chat=nonexistent-id");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "AI 学习伙伴" })).toBeVisible();
    await expect(page.getByPlaceholder(/输入指令|配置 AI/)).toBeVisible();
  });

  test("手机端旧 /chat 链接以全屏 AI 工作区呈现", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chat");

    await expect(page.getByRole("heading", { name: "AI 学习伙伴" })).toBeVisible();
    await expect(page.getByPlaceholder(/输入指令|配置 AI/)).toBeVisible();
  });
});
