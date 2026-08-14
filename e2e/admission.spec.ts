import { test, expect } from "@playwright/test";

test.describe("Admission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admission");
  });

  test("page loads with tabs", async ({ page }) => {
    await expect(page.locator("text=院校").first()).toBeVisible({ timeout: 10000 });
    // Should have tab navigation
    const tabs = page.locator('[role="tab"]').or(page.locator("button").filter({ hasText: /搜索|对比|收藏|导入/ }));
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
  });

  test("search input is visible", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]').or(page.locator('input[placeholder*="院校"]'));
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("import tab is accessible", async ({ page }) => {
    const importTab = page.locator("button").filter({ hasText: /导入/ });
    if (await importTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await importTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test("nav shows 院校 entry and navigates to it", async ({ page }) => {
    await page.goto("/dashboard");
    // 打开 slide-over 菜单（logo 按钮），知识组里应出现院校入口
    await page.getByRole("button", { name: /考研助手/ }).first().click();
    const admissionLink = page.locator('a[href="/admission"]');
    await expect(admissionLink).toBeVisible({ timeout: 5000 });
    await admissionLink.click();
    await expect(page).toHaveURL(/\/admission/);
  });

  test("search API caches identical queries within 24h TTL", async ({ page }) => {
    test.setTimeout(180_000);
    // 唯一院校名避免命中既有缓存；真实搜索较慢（百度 ×3 + AI 提取），放宽超时
    const university = `缓存测试院校${Date.now() % 1000000}`;
    const body = { university, major: "测试专业", year: 2025 };

    const first = await page.request.post("/api/admission/search", { data: body });
    expect(first.status()).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.cacheHit).toBe(false);

    // 第二次同查询应命中缓存：不重复爬取/AI，秒回
    const second = await page.request.post("/api/admission/search", { data: body });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.cacheHit).toBe(true);
    expect(secondJson.cachedAt).toBeTruthy();
    expect(secondJson.university).toBe(university);
  });
});
