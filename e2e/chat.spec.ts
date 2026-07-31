import { test, expect } from "@playwright/test";

test.describe("Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
  });

  test("chat interface is visible", async ({ page }) => {
    await expect(page.locator("text=AI 问答")).toBeVisible({ timeout: 10000 });
    // Input field
    await expect(page.locator('input[placeholder*="问题"]').or(page.locator('input[placeholder*="资料"]'))).toBeVisible();
    // Send button
    await expect(page.getByRole("button", { name: /发送/ })).toBeVisible();
  });

  test("empty state shows prompts", async ({ page }) => {
    await expect(page.locator("text=开始提问吧")).toBeVisible({ timeout: 10000 });
  });

  test("history button toggles panel", async ({ page }) => {
    const historyBtn = page.getByRole("button", { name: /历史/ });
    await expect(historyBtn).toBeVisible({ timeout: 10000 });
    await historyBtn.click();
    await expect(page.locator("text=历史对话")).toBeVisible({ timeout: 5000 });
  });

  test("URL param ?chat= works", async ({ page }) => {
    await page.goto("/chat?chat=nonexistent-id");
    await page.waitForTimeout(2000);
    // Should not crash, just show empty or default state
    await expect(page.locator("text=AI 问答")).toBeVisible({ timeout: 10000 });
  });
});
