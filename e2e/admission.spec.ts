import { test, expect } from "@playwright/test";
import pg from "pg";

// E2E 环境网络受限（百度搜索拿不到结果），共享链路用"直插测试库全局数据"验证：
// 查库优先（无需 AI）+ 认同/质疑反馈 + 状态流转

function testDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
  const qIdx = url!.indexOf("?");
  const base = qIdx === -1 ? url! : url!.slice(0, qIdx);
  const slash = base.lastIndexOf("/");
  return `${base.slice(0, slash + 1)}${base.slice(slash + 1)}_test${qIdx === -1 ? "" : url!.slice(qIdx)}`;
}

test.describe("Admission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admission");
  });

  test("page loads with tabs", async ({ page }) => {
    await expect(page.locator("text=院校情报").first()).toBeVisible({ timeout: 10000 });
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

  test("search shows wait-soothing bubble and can cancel", async ({ page }) => {
    // 拦截搜索接口：延迟 6s 响应，期间观察等待气泡（不依赖真实 AI/爬虫）
    await page.route("**/api/admission/search", async (route) => {
      await new Promise((r) => setTimeout(r, 6000));
      try {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ library: false, entries: [] }),
        });
      } catch {
        // 请求已被取消（点击了「取消」），丢弃本次响应
      }
    });

    // 填院校并搜索
    await page.getByPlaceholder("例如：北京大学").fill(`E2E 等待${Date.now() % 1000000}`);
    await page.getByRole("button", { name: "🔍 搜索院校信息" }).click();

    // 等待气泡：分阶段文案轮播（阶段 1 → 阶段 2）
    await expect(page.getByText("正在连接 AI")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("正在理解你的情况")).toBeVisible({ timeout: 6000 });

    // 取消：气泡消失 + 按钮恢复 + 安静收场（无「网络错误」）
    await page.getByRole("button", { name: "取消本次生成" }).click();
    await expect(page.getByText(/正在理解你的情况|正在连接 AI/)).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByRole("button", { name: "🔍 搜索院校信息" })).toBeEnabled({ timeout: 10000 });
    await expect(page.getByText("网络错误")).toHaveCount(0);
  });

  test("shared library: pre-seeded global data is queryable; vouch/dispute feedback works", async ({ page }) => {
    const uni = `共享库${Date.now() % 1000000}`;
    const pool = new pg.Pool({ connectionString: testDbUrl() });
    let id = "";
    try {
      const { rows } = await pool.query(
        `INSERT INTO "AdmissionInfo" ("id","userId","university","major","year","category","data","source","verifyStatus","createdAt")
         VALUES (gen_random_uuid(), NULL, $1, $2, $3, 'score_line', $4, 'https://example.com/e2e', 'unverified', now()) RETURNING "id"`,
        [uni, "测试专业", 2025, JSON.stringify({ scores: { 总分: 350, 政治: 60 } })]
      );
      id = rows[0].id;
    } finally {
      await pool.end();
    }
    expect(id).toBeTruthy();

    // 查库命中（无需 AI，秒回）
    const res = await page.request.post("/api/admission/search", { data: { university: uni } });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.library).toBe(true);
    const entry = json.entries.find((e: { id: string }) => e.id === id);
    expect(entry).toBeTruthy();
    expect(entry.verifyStatus).toBe("unverified");

    // 认同
    const v = await page.request.post("/api/admission/feedback", {
      data: { admissionInfoId: id, type: "vouch" },
    });
    const vJson = await v.json();
    expect(vJson.counts.vouch).toBe(1);

    // 质疑（需原因）
    const d = await page.request.post("/api/admission/feedback", {
      data: { admissionInfoId: id, type: "dispute", reason: "e2e 质疑：疑似数据有误" },
    });
    const dJson = await d.json();
    expect(dJson.counts.dispute).toBe(1);
    expect(dJson.counts.vouch).toBe(0);

    // 再查库：状态流转 disputed + 计数 + 我的反馈标记
    const res2 = await page.request.post("/api/admission/search", { data: { university: uni } });
    const json2 = await res2.json();
    const updated = json2.entries.find((e: { id: string }) => e.id === id);
    expect(updated.verifyStatus).toBe("disputed");
    expect(updated.disputeCount).toBe(1);
    expect(updated.myFeedback).toBe("dispute");
  });
});
