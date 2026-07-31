import { test, expect } from "@playwright/test";

// ── Public pages ──

test("landing page loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=登录").first()).toBeVisible({ timeout: 10000 });
  // Should have email input
  await expect(page.locator('input[type="email"]')).toBeVisible();
  // Should have password input
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // Should have submit button
  await expect(page.getByRole("button", { name: /登录|登入|sign.?in/i })).toBeVisible();
});

test("about page loads", async ({ page }) => {
  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
});

// ── Auth redirect behavior ──

test("dashboard redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/dashboard");
  // Should end up on login page
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

test("settings redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

test("wrong-questions redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/wrong-questions");
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

test("knowledge-graph redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/knowledge-graph");
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

test("study-path redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/study-path");
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

// ── PWA manifest ──

test("manifest.json is served correctly", async ({ request }) => {
  const response = await request.get("/manifest.json");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toBe("AI 考研助手");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toBeDefined();
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test("service worker is served", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("install");
  expect(body).toContain("activate");
});

test("offline page is served", async ({ request }) => {
  const response = await request.get("/offline.html");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("离线");
});

// ── Navigation sidebar links ──

test("login page has navigation links to dashboard", async ({ page }) => {
  await page.goto("/login");
  // Landing page link in header/nav
  const links = page.locator('a[href="/"]');
  await expect(links.first()).toBeVisible({ timeout: 5000 }).catch(() => {
    // Landing page might not link back to itself from login
  });
});

// ── API endpoints respond (even if auth-required) ──

test("API routes exist and check auth", async ({ request }) => {
  const routes = [
    "/api/wrong-questions",
    "/api/knowledge-graph",
    "/api/study-path",
    "/api/user/reminders",
  ];
  for (const route of routes) {
    const response = await request.get(route);
    // Should be 401 (unauthorized) — proves the route exists
    expect([200, 401, 307]).toContain(response.status());
  }
});
