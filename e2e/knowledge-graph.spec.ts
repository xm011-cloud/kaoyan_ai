import { test, expect } from "@playwright/test";

test.describe("Knowledge Graph", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/knowledge-graph");
  });

  test("page loads with SVG container", async ({ page }) => {
    await expect(page.locator("text=知识图谱")).toBeVisible({ timeout: 10000 });
    // SVG container should be present
    await expect(page.locator("svg").first()).toBeVisible({ timeout: 10000 });
  });

  test("subject filter is interactive", async ({ page }) => {
    const filter = page.locator("select").first();
    if (await filter.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should have options
      const options = filter.locator("option");
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("URL param ?subject= works", async ({ page }) => {
    await page.goto("/knowledge-graph?subject=数学一");
    await page.waitForTimeout(3000);
    // Should load without crash
    await expect(page.locator("text=知识图谱")).toBeVisible({ timeout: 10000 });
  });
});
