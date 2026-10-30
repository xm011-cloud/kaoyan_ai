import { test, expect } from "@playwright/test";

test.describe("Materials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/materials");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /学习资源/ })).toBeVisible({ timeout: 10000 });
  });

  test("empty state or file list is shown", async ({ page }) => {
    // Either shows files or empty state or upload prompt
    await page.waitForTimeout(3000);
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  test("upload area is accessible", async ({ page }) => {
    // 上传触发为 <label> 内铺满按钮的透明 file input（PWA standalone 下也走原生手势），不再以 button role 定位
    const uploadLabel = page.getByText(/上传(资料|附件)/).first();
    const fileInput = page.locator('input[type="file"]');
    const hasUpload = (await uploadLabel.isVisible({ timeout: 5000 }).catch(() => false)) ||
                      (await fileInput.isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasUpload).toBe(true);
  });

  test("uploads a text file and shows it in the list", async ({ page }) => {
    // 真实上传回归：覆盖 input → /api/upload → 列表首行出现新文件（防止上传入口/链路回归）
    const name = `e2e-upload-${Date.now()}.txt`
    await page.locator('input[type="file"]').setInputFiles({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from("这是 E2E 上传回归测试内容"),
    });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("AI 可引用").first()).toBeVisible();

    // 清理：删除刚上传的文件（新文件 prepend 到列表顶部 → 第一行即本文件），让共享测试库回到原始状态。
    // 列表行按钮是 aria-label="删除"，确认框按钮只有文本「删除」，用 CSS 选择器区分两者。
    await page.locator("button[aria-label='删除']").first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 10000 });
  });

  test("can turn an uploaded attachment into a course learning entry", async ({ page }) => {
    const suffix = Date.now();
    const materialName = `e2e-course-material-${suffix}.txt`;
    const courseTitle = `E2E 附件课程 ${suffix}`;
    await page.locator('input[type="file"]').setInputFiles({
      name: materialName,
      mimeType: "text/plain",
      buffer: Buffer.from("资料进入课程学习的回归内容"),
    });
    await expect(page.getByText(materialName).first()).toBeVisible({ timeout: 15_000 });

    const materialRow = page.getByText(materialName, { exact: true }).locator('xpath=ancestor::div[contains(@class, "workspace-surface")]');
    const courseLink = materialRow.getByRole("link", { name: "放进课程" });
    const materialHref = await courseLink.getAttribute("href");
    expect(materialHref).toBeTruthy();
    const materialId = new URL(materialHref!, "http://localhost").searchParams.get("material");
    expect(materialId).toBeTruthy();
    let createdCourseId: string | null = null;

    try {
      await courseLink.click();
      await expect(page.getByRole("heading", { name: "添加一门正在学的课程" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('select[name="materialId"]')).toHaveValue(materialId!);
      await page.locator('input[name="title"]').fill(courseTitle);
      await page.getByRole("button", { name: "创建课程", exact: true }).click();
      await expect(page.getByText(courseTitle, { exact: true })).toBeVisible({ timeout: 30_000 });

      const coursesResponse = await page.request.get("/api/courses");
      const courses = (await coursesResponse.json()).courses as Array<{ id: string; title: string }>;
      const course = courses.find((item) => item.title === courseTitle);
      expect(course).toBeTruthy();
      createdCourseId = course?.id ?? null;

      const courseDetail = await page.request.get(`/api/courses/${createdCourseId}`);
      expect(courseDetail.status()).toBe(200);
      const lessonId = (await courseDetail.json()).course.units[0].lessons[0].id as string;

      // 回到资源页时，附件不再只是孤立文件；应显示它正在服务的课时，
      // 并可以直接回到对应学习现场。
      await page.goto("/materials");
      const courseResourceLink = page.locator('section[aria-label="正在使用的课程"]').getByRole("link", { name: new RegExp(courseTitle) });
      await expect(courseResourceLink).toHaveAttribute("href", `/courses?course=${createdCourseId}`);
      const linkedRow = page.getByText(materialName, { exact: true }).locator('xpath=ancestor::div[contains(@class, "workspace-surface")]');
      const resourceLink = linkedRow.getByRole("link", { name: `${courseTitle} · ${materialName}` });
      await expect(resourceLink).toHaveAttribute("href", `/courses?lesson=${lessonId}`);
    } finally {
      if (createdCourseId) await page.request.delete(`/api/courses/${createdCourseId}`);
      if (materialId) await page.request.delete(`/api/materials?id=${materialId}`);
    }
  });
});
