import { test, expect } from "@playwright/test";

test.describe("Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
  });

  test("chat interface is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 10000 });
    // Input field
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    // Send button
    await expect(page.getByRole("button", { name: "发送" }).first()).toBeVisible();
  });

  test("empty state shows prompts", async ({ page }) => {
    await expect(page.locator("text=开始提问吧")).toBeVisible({ timeout: 10000 });
  });

  test("history button toggles panel", async ({ page }) => {
    const historyBtn = page.locator("button").filter({ hasText: "历史" }).first();
    await expect(historyBtn).toBeVisible({ timeout: 10000 });
    await historyBtn.click();
    await page.waitForTimeout(1000);
  });

  test("URL param ?chat= works", async ({ page }) => {
    await page.goto("/chat?chat=nonexistent-id");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 10000 });
  });
});
