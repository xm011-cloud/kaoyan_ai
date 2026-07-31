import { chromium, type FullConfig } from "@playwright/test";

/**
 * Global setup: logs in via the UI and saves storage state
 * so all authenticated tests can reuse the session.
 */
async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_TEST_USER;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      "⚠️  E2E_TEST_USER / E2E_TEST_PASSWORD not set — skipping authenticated tests"
    );
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    // Fill in credentials and submit
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole("button", { name: /登录|登入|sign.?in/i }).click();

    // Wait for redirect to dashboard (or any authenticated page)
    await page.waitForURL(/\/(dashboard|goal|tasks)/, { timeout: 15000 });

    // Save storage state (cookies + localStorage)
    await page.context().storageState({ path: "e2e/.auth/user.json" });
    console.log("✅ Auth state saved to e2e/.auth/user.json");
  } catch (err) {
    console.error("❌ Global setup failed:", err);
    // Don't throw — let tests fail individually so we can see which ones
  } finally {
    await browser.close();
  }
}

export default globalSetup;
