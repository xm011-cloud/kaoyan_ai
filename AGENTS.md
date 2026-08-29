<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目启动

## 本地开发

```bash
npm run dev          # 启动 Next.js 开发服务器 (Turbopack, 默认 :3000)
npx tsc --noEmit     # TypeScript 类型检查
npm run lint         # ESLint
npx playwright test  # E2E 测试
```

## 构建 & 部署

```bash
npm run build        # 生产构建
npx vercel --prod    # 部署到 Vercel (c6-orcin.vercel.app)
```

## 数据库

```bash
npx prisma db push   # 推送 Schema 到数据库
npx prisma generate  # 重新生成 Prisma Client
npx prisma studio    # 打开 Prisma 数据管理界面
```

## E2E 测试（无单测框架，全走 Playwright）

```bash
npx playwright test                          # 全部 122+ 用例
npx playwright test dashboard.spec.ts        # 单个文件
npx playwright test dashboard.spec.ts -g "标题" # 单个用例
npx playwright test --ui                     # UI 模式
```

测试基础设施（见 `playwright.config.ts`）自动做这些事，跑测试前不用手动准备：

1. **独立测试库**：`e2e/create-test-db.mjs` 把 `DATABASE_URL` 的库名追加 `_test`（如 `neondb` → `neondb_test`），不污染开发数据
2. `prisma db push` 同步 schema 到测试库
3. **独立端口 3100** 起 dev server（避开 :3000），注入测试库环境变量
4. 认证态：`authenticated` project 复用 `e2e/.auth/user.json` 的登录会话（由 `e2e/global-setup.ts` 用 `E2E_TEST_USER`/`E2E_TEST_PASSWORD` 环境变量登录 UI 生成）；`unauthenticated` project 无登录态
5. Playwright 不自动读 `.env.local`，`playwright.config.ts` 和 `global-setup.ts` 都手动加载它

改 schema 后跑 E2E，测试库会自动重建；若加了新模块的 spec，记得把它登记到 `playwright.config.ts` 的 `authenticated` project 的 `testMatch` 列表。

# 架构速览

## 环境变量（MemFire 优先，Supabase 回退）

所有配置经 `src/lib/env-config.ts` 统一读取。`NEXT_PUBLIC_MEMFIRE_*` 优先，未配则回退 `NEXT_PUBLIC_SUPABASE_*`（两者同 SDK，仅 URL/Key 不同）；数据库连接同理（`MEMFIRE_DATABASE_URL` → `DATABASE_URL`）。**新增认证/数据库相关配置从这里读**（其它如 `TAVILY_API_KEY`、`ADMIN_EMAIL` 直接 `process.env`）。数据库连接串会被规范化为 `sslmode=verify-full`。

## 认证（Supabase Auth + PKCE）

- `src/proxy.ts` = Next 16 middleware，负责登录保护 + 会话刷新（`src/lib/supabase/middleware.ts`）
- `src/lib/supabase/` 四文件分工：`client.ts` 浏览器端 / `server.ts` Server Component / `service.ts` service_role（绕过 RLS，仅服务端）/ `middleware.ts` proxy 逻辑
- API 路由取用户统一用 `src/lib/api-auth.ts` 的 `getAuthUser(request)`，返回 `{ user, error }`；`/admin` 用 `ADMIN_EMAIL` 环境变量校验（fail closed）

## 数据层（Prisma driver adapter）

`src/lib/prisma.ts` 用 **`@prisma/adapter-pg` + `pg.Pool`**（driver adapter），连接串来自 `envConfig`，全局单例。写新 Prisma 代码沿用此模式；schema 里不要用传统直连覆盖。模型见 `prisma/schema.prisma`：核心为 User / Goal / Task / CheckIn / Material / Chat / Skill / WrongQuestion(SM-2) / PracticeSession / PomodoroSession / KnowledgeNode / StudyPath / AdmissionInfo 等。Material.embedding 是 `vector(1536)`（pgvector），用 `src/lib/vector.ts` 处理嵌入。

## 阶段与完成度（跨页面核心逻辑，2026-08 新增）

- `src/lib/prep-stage.ts`：`derivePrepStage()` 四段阶段推导 — 探索(explore)/基础(foundation)/备考(prep)/冲刺(sprint)，由「目标状态 + 距考试天数 + 科目完成度 + 每周课业容量」共同决定，返回阶段文案/紧迫度/焦点；`stageToPlanPhase()` 把阶段映射回任务 phase 名
- `src/lib/completion.ts`：完成度模型 v3 — 五档(not_started/learning/foundation/intensifying/mastering) + 对话校准(`calibratedStage`/`confidence`) + 保守软门控(`needsConfirmation`)。`getEffectiveStage()` 是唯一取档位入口（校准 > 自评 > percent 推断）；`SUBJECT_COMPLETION_GUIDE` 是科目感知的"基础完成"标准
- 阶段推导、AI 计划生成、`/api/ai/probe-mastery`（对话校准档位）、首页阶段态都走这两个模块；设计详见 `docs/completion-model.md`

## AI 层（用户自带 Key + Function Calling）

- 用户在设置页自配 Key（MiMo/DeepSeek/通义等 OpenAI 兼容），服务端 `getUserAiConfig(userId)` 取配置，回退全局 `OPENAI_API_KEY`；未配置返回 `null` → 前端给配置引导
- `src/lib/ai-config.ts` 的 `callAI()` 是统一调用（fetch `/chat/completions` + tools + reasoning），`extractJson`/`extractJsonArray` 提 JSON
- `src/lib/ai-tools.ts`：工具注册表 `TOOL_ENTRIES`（每个工具含 definition + executor），`/api/ai/chat` 跑 tool-calling 循环（`MAX_TOOL_ITERATIONS = 5`）。写操作返回 `actionCard` 供前端渲染操作卡；只有技能运行会注入 `skill_control` 工具
- **技能（Skill）= 带 `skillId` 的对话**：注入数据快照 + 流程 prompt + 档案 note，跨会话累积
- RAG：`src/lib/rag.ts` + `vector.ts`（资料向量化检索）；联网搜索：`src/lib/search.ts`（Tavily）
- 驾驶模式三档 `auto/assisted/manual` 存在 User.drivingMode，服务端直读

## API 约定

- 返回用户私有数据的路由一律用 `jsonNoStore()`（no-store 头）；出错用 `handleApiError(err, context)` → `{ error }` + 500，两者都在 `src/lib/api-utils.ts`
- 公共/防滥用接口用 `src/lib/rate-limit.ts`（如院校搜索 5/min/IP、支持留言 3/min/IP）
- 典型路由骨架：`getAuthUser(request)` → 校验 → 业务 → `jsonNoStore(...)`

## 前端

- 客户端状态：zustand persist（`src/stores/`，如 pomodoro-store / practice-store）+ React Query（`src/lib/query-provider.tsx`，练习等用 `src/hooks/use-*.ts`）
- 登录后页面在 `src/app/(authenticated)/`，用 `Shell` 外壳布局（`src/components/shell.tsx`，含 Header/ActivityBar/MobileNav/PomodoroEngine 等全局件）
- 首页工作台 = `src/components/workbench/` 卡片系统：`CARD_REGISTRY` 注册表（`layout: 'full'|'half'`）+ ui-store 的 `workspaceCards` 有序数组决定排序；探索期 `EXPLORATION_HIDDEN` 隐藏空卡/死卡。新卡片在此注册；布局保持有序数组形状（ADR 3.6 / D6 留口）
- 共享类型放 `src/lib/*-types.ts`（如 `practice-types.ts`）供前后端一致引用

## PWA / 离线（改缓存记得升版本）

- `public/sw.js`：`CACHE_NAME = 'c6-study-v5'`。**改任何静态资源/离线逻辑后把版本号 +1**，配 `src/components/sw-update-notice.tsx` 的刷新浮条，否则用户拿到旧缓存
- `src/lib/offline-queue.ts`：IndexedDB 写入队列，断网排队、联网按序补传。只放「可安全重放」的写操作（打卡、任务完成态），用 `dedupeKey` 归并同一目标最新状态；4xx 出队，网络错误/5xx 保留

## 文档索引

- `docs/architecture-decisions.md` — **架构决策记录（ADR）**：产品定位 + D1-D6 接口决策 + 阶段 0-3 路线。写新功能前先看这里对齐方向，避免推倒重来
- `docs/completion-model.md` — 完成度模型设计（五档 + 科目感知 + 对话校准 + 保守门控）
- `docs/usage-notes.md` — 狗粮测试日志（开发者真实"用不下去"记录 → 产品 backlog）
- `docs/edgeone-deploy.md` — 国内 EdgeOne 部署方案（Cloud SSR 函数包超限，暂缓）
- `docs/memfire-migration.md` — MemFire 迁移说明
- `PROJECT_STATUS.md` — 已实现功能清单；`README.md` — 产品介绍

## 关键约定

- 环境变量: `.env.local` (本地) / `.env` (共享) / `.env.vercel`
- 认证: Supabase Auth (支持 MemFire Cloud 替代，相同 SDK)
- AI: OpenAI 兼容 API (默认 MiMo `https://api.xiaomimimo.com/v1`)
- 数据库: PostgreSQL + pgvector (Neon 免费)
- Prisma: driver adapter 模式 (`@prisma/adapter-pg` + `pg.Pool`)，不是传统直连
- Middleware 在 `src/proxy.ts` (Next.js 16 convention)
- Tailwind CSS v4 + shadcn/ui (base-nova, CSS variables)
- 路径别名 `@/*` → `./src/*`
- 代码注释与产品文案用中文；新代码与周围风格一致
- 开发规则详见 [README.md](./README.md)
- 项目状态详见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)
