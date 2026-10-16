import { test as setup, type Browser } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // 本地没有 .env.local 时，仍允许 CI 从环境变量提供认证信息。
  }
}

function nextMondayLocal(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day) + 7);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 共享认证账号在每次 E2E 启动前都会被清空学习数据，因此产品会正确地把它
 * 识别为新用户。业务回归不应被首次引导遮挡；专门的 onboarding.spec.ts
 * 使用新注册账号验证该流程。这里把“已读”写入 storageState，确保两类用例
 * 各自验证自己的边界。
 */
async function initializeE2EClientPreferences(page: import("@playwright/test").Page, nextMonday: string) {
  await page.evaluate((nextMondayValue) => {
    localStorage.setItem("weeklyPlanPrompted", nextMondayValue);
    localStorage.setItem("ui-store", JSON.stringify({
      state: { onboardingSeen: true },
      version: 10,
    }));
  }, nextMonday);
}

/** 状态文件里的 Supabase cookie 含 expires_at；过期 token 不能只靠本地 API 探针复用。 */
function hasFreshAuthSession(authStatePath: string) {
  try {
    const state = JSON.parse(readFileSync(authStatePath, "utf-8")) as {
      cookies?: Array<{ name?: string; value?: string }>;
    };
    const authCookie = state.cookies?.find(({ name }) =>
      typeof name === "string" && name.startsWith("sb-") && name.endsWith("-auth-token"),
    );
    if (!authCookie?.value?.startsWith("base64-")) return false;
    const session = JSON.parse(Buffer.from(authCookie.value.slice("base64-".length), "base64").toString("utf8")) as {
      expires_at?: unknown;
    };
    // 给测试运行留出五分钟余量，避免长套件中途失效。
    return typeof session.expires_at === "number" && session.expires_at > Math.floor(Date.now() / 1000) + 300;
  } catch {
    return false;
  }
}

/**
 * access token 的 expires_at 只代表当前令牌有效期，session 内仍有可续期的
 * refresh token。若把浏览器 Cookie 的过期时间也设成 expires_at，长时间 E2E
 * 回归会在后半程把整个会话直接删除，服务端失去刷新令牌而统一返回 401。
 *
 * Playwright 的 session Cookie 在同一次浏览器上下文中保持有效；这里把认证
 * Cookie 规范化为 session Cookie，让中间件/Supabase 客户端可以正常续期。
 */
async function persistAuthState(context: import("@playwright/test").BrowserContext, authStatePath: string) {
  const state = await context.storageState();
  state.cookies = state.cookies.map((cookie) => (
    typeof cookie.name === "string" && cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")
      ? { ...cookie, expires: -1 }
      : cookie
  ));
  writeFileSync(authStatePath, JSON.stringify(state, null, 2));
}

/**
 * 认证页本身需要依赖外部 Auth 的前端重定向。E2E 初始化只需要一个真实会话，
 * 直接走同一服务的 password grant 能避免浏览器加载抖动拖垮整套业务回归。
 */
async function createAuthStateByPasswordGrant(
  browser: Browser,
  origin: string,
  email: string,
  password: string,
  authStatePath: string,
) {
  const projectUrl = process.env.NEXT_PUBLIC_MEMFIRE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!projectUrl || !anonKey) throw new Error("缺少 Supabase/MemFire 客户端配置，无法初始化 E2E 会话");

  const response = await fetch(`${projectUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`E2E password grant 失败（HTTP ${response.status}）`);

  const session = await response.json() as { expires_at?: unknown };
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const context = await browser.newContext();
  try {
    await context.addCookies([{
      name: `sb-${projectRef}-auth-token`,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    }]);
    const page = await context.newPage();
    // 登录页在已有会话时会重定向到需要大量数据请求的工作台；这里仅需写入
    // 同源的测试偏好，因此走公开且轻量的页面，避免认证 setup 被首页加载拖住。
    await page.goto(`${origin}/support`, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await initializeE2EClientPreferences(page, nextMondayLocal());
    const probe = await page.request.get(`${origin}/api/goal`, { timeout: 15_000 });
    if (!probe.ok()) throw new Error(`E2E 本地会话探针失败（HTTP ${probe.status()}）`);
    await persistAuthState(context, authStatePath);
  } finally {
    await context.close();
  }
}

/**
 * 认证 setup 仅作为 authenticated 项目的依赖。
 * 不使用全局 setup：即使 Supabase 临时不可达，--project=unauthenticated 仍可验证公开页。
 */
setup("创建可信认证态", async ({ browser, baseURL }) => {
  setup.setTimeout(75_000);
  loadEnvLocal();
  const email = process.env.E2E_TEST_USER;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_USER / E2E_TEST_PASSWORD 未配置，不能运行 authenticated 项目");
  }

  mkdirSync(resolve(process.cwd(), "e2e", ".auth"), { recursive: true });
  const authStatePath = resolve(process.cwd(), "e2e", ".auth", "user.json");
  // 已有会话先通过本地 E2E 鉴权探针复用，避免每次完整套件都额外请求一次
  // 外部 Auth 服务。探针失败才回退到真实 UI 登录，绝不复用未验证的状态文件。
  if (existsSync(authStatePath) && hasFreshAuthSession(authStatePath)) {
    const existingContext = await browser.newContext({ storageState: authStatePath });
    try {
      const origin = baseURL || "http://localhost:3100";
      const probePage = await existingContext.newPage();
      const probe = await probePage.request.get(`${origin}/api/goal`, { timeout: 15_000 });
      if (probe.ok()) {
        // 旧 storageState 可能在引入该偏好前生成；复用时也必须补齐，
        // 否则清库后的共享账号会被首次引导遮挡。
        await probePage.goto(`${origin}/support`, { waitUntil: "domcontentloaded", timeout: 10_000 });
        await initializeE2EClientPreferences(probePage, nextMondayLocal());
        await persistAuthState(existingContext, authStatePath);
        console.log("✅ Reused verified E2E auth state");
        return;
      }
    } catch {
      // 过期或不完整的状态必须重新走真实登录，不能把失败会话留给后续项目。
    } finally {
      await existingContext.close();
    }
  }

  try {
    const origin = baseURL || "http://localhost:3100";
    await createAuthStateByPasswordGrant(browser, origin, email, password, authStatePath);
    console.log("✅ Auth state initialized by verified password grant");
    return;
  } catch (grantError) {
    console.warn("⚠️  E2E password grant 初始化失败，回退浏览器登录", grantError instanceof Error ? grantError.message : "unknown error");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const origin = baseURL || "http://localhost:3100";
      await page.goto(`${origin}/login`);
      await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.getByRole("button", { name: /登录|登入|sign.?in/i }).click();
      await page.waitForURL(/\/(dashboard|goal|tasks)/, { timeout: 15_000 });

      // 触发隔离测试库的本地用户落库；失败仍由后续真实 API 暴露，而不会写出伪造会话。
      await page.request.get(`${origin}/api/goal`).catch(() => undefined);
      await initializeE2EClientPreferences(page, nextMondayLocal()).catch(() => undefined);
      await persistAuthState(context, authStatePath);
      console.log("✅ Auth state saved to e2e/.auth/user.json");
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`⚠️  E2E 登录初始化第 ${attempt} 次失败，正在重试`);
        await wait(attempt * 1_500);
      }
    } finally {
      await context.close();
    }
  }
  throw new Error("E2E 登录初始化连续失败，authenticated 项目未执行", { cause: lastError });
});
