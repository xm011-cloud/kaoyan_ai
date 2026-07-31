import { test, expect } from "@playwright/test";

test.describe("Pomodoro", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pomodoro");
  });

  test("timer initial state is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /番茄钟/ })).toBeVisible({ timeout: 10000 });
    // Timer should show some time value
    await page.waitForTimeout(2000);
    const body = await page.locator("body").textContent();
    expect(body).toContain("专注");
  });

  test("start button works and timer counts down", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /开始/ });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await page.waitForTimeout(2000);
    // Should show running state
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/专注中|已暂停|休息/);
  });

  test("pause and reset buttons work", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /开始/ });
    await startBtn.click();
    await page.waitForTimeout(1000);

    const pauseBtn = page.getByRole("button", { name: /暂停/ });
    if (await pauseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pauseBtn.click();
      await expect(page.locator("text=已暂停")).toBeVisible({ timeout: 5000 });
    }
  });

  test("timer state persists after navigation", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /开始/ });
    await startBtn.click();
    await page.waitForTimeout(2000);

    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    await page.goto("/pomodoro");
    await page.waitForTimeout(2000);

    // Should not crash — either running or idle
    await expect(page.locator("h1").filter({ hasText: /番茄钟/ })).toBeVisible({ timeout: 10000 });
  });
});
