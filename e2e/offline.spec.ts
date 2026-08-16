import { test, expect } from "@playwright/test";

/**
 * 离线能力：
 * - 离线横幅出现/消失
 * - 离线打卡 → 乐观成功 +「离线已保存」提示 + 入队
 * - 恢复联网 → 队列自动补传 → 刷新后读到服务端真实数据
 *
 * 注意：打卡按日期 upsert，今天可能已被 checkin.spec.ts 打卡（fullyParallel），
 * 所以进入页面时若已是成功态，先点「修改打卡」回到编辑态，断言也只做宽泛检查。
 */
test.describe("Offline", () => {
  test("offline banner + offline check-in queues and syncs on reconnect", async ({ page, context }) => {
    await page.goto("/checkin");
    await page.waitForTimeout(1500);

    // 若今天已打卡 → 回到编辑态
    const alreadySubmitted = await page
      .getByText("今日已打卡", { exact: false })
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (alreadySubmitted) {
      await page.locator("main").getByRole("button", { name: "修改打卡" }).click();
      await page.waitForTimeout(500);
    }

    // 切到离线 → 横幅出现
    await context.setOffline(true);
    await expect(page.getByText(/离线模式/)).toBeVisible({ timeout: 5000 });

    // 离线提交打卡 → 乐观成功 + 离线提示
    await page.fill("#checkin-duration", "45");
    await page.locator("main").getByRole("button", { name: /完成打卡|打卡/ }).first().click();
    await expect(page.getByText("今日已打卡", { exact: false }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/离线已保存/)).toBeVisible();

    // 恢复联网 → 队列补传 → 横幅消失
    await context.setOffline(false);
    await expect(page.getByText(/离线模式/)).toBeHidden({ timeout: 8000 });

    // 刷新后从服务端读到真实数据（不再显示离线提示）
    await page.reload();
    await expect(page.getByText("今日已打卡", { exact: false }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/离线已保存/)).toBeHidden();
  });
});
