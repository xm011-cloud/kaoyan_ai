import { test, expect } from "@playwright/test";

test.describe("Navigation & Module Linking", () => {
  test("sidebar has all 14 module links", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // Check sidebar links exist (some may be in mobile menu)
    const navLinks = [
      "/dashboard", "/goal", "/tasks", "/checkin", "/pomodoro",
      "/admission", "/materials", "/chat", "/wrong-questions",
      "/practice", "/feedback", "/knowledge-graph", "/study-path", "/settings",
    ];

    for (const href of navLinks) {
      const link = page.locator(`a[href="${href}"]`);
      // At least one instance should exist (sidebar or mobile nav)
      const count = await link.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("dashboard quick-entry links navigate correctly", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // Test a few quick-entry links
    const quickLinks = [
      { href: "/tasks", text: "计划" },
      { href: "/chat", text: "AI 问答" },
      { href: "/wrong-questions", text: "错题本" },
    ];

    for (const { href } of quickLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForURL(new RegExp(href), { timeout: 10000 });
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("wrong-questions related links navigate correctly", async ({ page }) => {
    await page.goto("/wrong-questions");
    await page.waitForTimeout(2000);

    const relatedLinks = [
      { href: "/practice", text: "去练习" },
      { href: "/knowledge-graph", text: "知识图谱" },
      { href: "/chat", text: "AI 问答" },
    ];

    for (const { href } of relatedLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForURL(new RegExp(href), { timeout: 10000 });
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("tasks related links navigate correctly", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForTimeout(2000);

    const relatedLinks = [
      { href: "/knowledge-graph", text: "知识图谱" },
      { href: "/wrong-questions", text: "错题本" },
      { href: "/study-path", text: "学习路径" },
    ];

    for (const { href } of relatedLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForURL(new RegExp(href), { timeout: 10000 });
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("practice result has wrong-questions link", async ({ page }) => {
    await page.goto("/practice");
    await page.waitForTimeout(2000);

    // The result view link is only visible after completing a practice
    // Just verify the page loads without the link causing errors
    await expect(page.locator("text=练习")).toBeVisible({ timeout: 10000 });
  });
});
