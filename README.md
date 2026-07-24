# AI 考研助手

> 面向考研学生的 AI 全栈备考平台。Next.js 16 + TypeScript + Prisma + PostgreSQL + Supabase + AI。

---

## 快速启动（本地开发）

### 1. 安装依赖

```bash
npm install
```

首次安装会自动执行 `prisma generate`（postinstall hook）。

### 2. 配置环境变量

复制模板并填写真实值：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，至少填写：

| 变量 | 说明 | 从哪里获取 |
|------|------|-----------|
| `DATABASE_URL` | PostgreSQL 连接串 | [Neon](https://neon.tech) 免费数据库 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | [Supabase](https://supabase.com) → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务 Key | 同上 |
| `OPENAI_API_KEY` | AI API Key | [MiMo 平台](https://platform.xiaomimimo.com) |

### 3. 初始化数据库

```bash
# 推送 Schema 到数据库
npx prisma db push

# （可选）启用 pgvector 扩展（用于 RAG 资料向量检索）
# Neon 控制台 → SQL Editor → 执行: CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，注册账号即可使用。

### 5. （可选）运行 E2E 测试

```bash
npx playwright test
```

---

## 部署

### Vercel（推荐，海外用户）

```bash
npx vercel --prod
```

首次部署需先 `npx vercel login` 登录，然后链接项目。Vercel 会自动识别 Next.js 框架。

**环境变量：** 在 Vercel Dashboard → Settings → Environment Variables 中添加 .env 中的所有变量。

### EdgeOne Pages（国内用户）

详见 [docs/edgeone-deploy.md](./docs/edgeone-deploy.md)。

简要步骤：
1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone/pages)
2. 导入 Git 仓库 → 选择 `dev` 分支
3. 配置环境变量（同上）
4. 自动部署

### 部署前检查

```bash
# 确认编译通过
npm run build

# 确认 Prisma client 已生成
npx prisma generate
```

---

## 开发规则

> 继续开发前请阅读本节。每次修改项目后同步更新 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。

---

## 1. 代码风格

**原则：与周围代码保持一致，不强制统一格式化。**

- 新文件模仿同目录下现有文件的风格（命名、缩进、注释密度）
- TypeScript strict mode 已开启，不允许 `any` 除非加 `// eslint-disable-next-line` 注释
- 中文用户界面文案用简中，代码注释可以用中文
- 路径别名 `@/*` 映射到 `./src/*`

---

## 2. 组件组织

```
src/
├── app/
│   ├── (authenticated)/           # 需登录的路由
│   │   ├── dashboard/page.tsx
│   │   ├── admission/
│   │   │   ├── page.tsx           # 多 tab 页面
│   │   │   └── _components/       # 页面专属组件
│   │   │       └── import-tab.tsx
│   │   └── ...
│   └── api/                       # API 路由 (每功能一个目录)
├── components/                    # 全局共享组件
│   └── ui/                        # shadcn/ui 基础组件
└── lib/                           # 工具库 (纯函数/无 JSX)
```

**拆分规则：**
- 弹窗/模态框 → 必须独立文件
- 页面超过 300 行 → 拆分子组件到 `_components/`
- 被 2+ 个页面复用的组件 → 提升到 `src/components/`
- 不追求过度原子化，合理的单文件大小在 100-300 行

**加载策略：**
- 重型图表库 (Recharts, D3) → `next/dynamic(() => import(...), { ssr: false })`
- 弹窗/模态框 → `next/dynamic` 懒加载

---

## 3. 服务端 vs 客户端

```
'use client' 边界判断:
├── 需要交互 (useState/useEffect/onClick/onChange) → 'use client'
├── 需要浏览器 API (localStorage, Notification, AudioContext) → 'use client'
├── 纯数据读取 + 渲染 → Server Component (默认，不加 'use client')
└── API 路由 → Server Component (默认)
```

**当前大部分页面是 `'use client'`，API 都是 Server Component。dashboard 是个例外：它是 async Server Component 直接调用 prisma。**

---

## 4. API 路由规范

```
目录结构:
src/app/api/<feature>/
├── route.ts              # GET list / POST create
├── [id]/route.ts         # GET one / PATCH / DELETE
└── <sub-action>/route.ts # 特殊操作 (import, build, progress, batch)

统一模式:
1. 第一行: const { user, error } = await getAuthUser(request)
2. 错误统一返回: NextResponse.json({ error: "..." }, { status: 4xx/5xx })
3. 成功统一返回: NextResponse.json({ ...data })
4. 异常: try/catch 包裹，console.error 日志，返回 500
```

**已有认证工具:** `src/lib/api-auth.ts` → `getAuthUser(request)` 支持 cookie + Bearer token 双通道

**已有 AI 工具:** `src/lib/ai-config.ts` → `getUserAiConfig(userId)` 返回 `{ apiKey, baseURL, model }` 或 null

---

## 5. 数据库操作

**Prisma 客户端:** `import { prisma } from '@/lib/prisma'` (单例，pg Pool 驱动)

**查询原则:**
- Server Component 可以直接 await prisma
- API 路由中始终加 `userId` 过滤
- 批量操作用 `Promise.all` + 独立 create/upsert
- 大数据集必须加 `take` 限制或日期范围过滤
- 写入统一用 `upsert` (有唯一约束时) 而非 `create` (防止重复)

**AdmissionInfo upsert 示例 (标准的创建/更新模式):**
```ts
await prisma.admissionInfo.upsert({
  where: { university_major_year_category: { university, major, year, category } },
  create: { userId, university, major, year, category, data, source },
  update: { data, source },
});
```

---

## 6. 认证流程

```
未登录用户 → 访问 (authenticated) 路由 → layout.tsx 检测无 user → redirect("/login")
已登录用户 → layout.tsx 通过 → 页面获取 user via:
  - Server Component: const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  - Client Component: API 路由自己验证 (getAuthUser)
```

**Middleware:** `src/proxy.ts` 只做 Supabase session 刷新，不做路由保护。路由保护在各 layout 层。

---

## 7. Git 提交规范

**格式：** `<type>: <简短中文描述>`

**Type 前缀：**
- `feat:` — 新功能
- `fix:` — 修复 bug
- `refactor:` — 重构代码
- `chore:` — 配置/依赖/工具变更
- `docs:` — 文档变更

**示例：**
```
feat: 院校情报手动导入功能
fix: 仪表盘 NaN children 错误
chore: 移除 pdf2json 依赖节省 80MB
refactor: 统一 AI 调用为 callAI 工具函数
```

不强制 commitlint，保持可读即可。

---

## 8. AI 使用范围

**AI 可以写所有类型的代码：** 业务逻辑、UI 组件、API 路由、测试、配置。人工 review 审查。

**AI 辅助开发时遵循：**
1. 先读取相关现有代码，复用已有工具/模式
2. 新代码与周围代码风格一致
3. 写完代码跑 `npx tsc --noEmit` 验证
4. 改动涉及多文件时先写 plan 再执行

---

## 9. 环境配置

| 文件 | 用途 |
|------|------|
| `.env.example` | 模板，不含真实值 |
| `.env` | 生产/共享环境变量 |
| `.env.local` | 个人本地覆盖 (gitignore) |

**关键环境变量：**
- `DATABASE_URL` — PostgreSQL 连接串 (Neon)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 客户端
- `SUPABASE_SERVICE_ROLE_KEY` — 服务端 only
- `OPENAI_API_KEY` — AI 全局 API Key (用户可在设置页覆盖)

支持 MemFire Cloud 替代 Supabase (相同 SDK，换 URL+Key)。

---

## 10. 此项目特有的注意事项

1. **Next.js 16 与旧版不同** — API、约定、文件结构可能与训练数据不同。重大改动前先参考 `node_modules/next/dist/docs/`。

2. **Prisma driver adapter 模式** — 使用 `@prisma/adapter-pg` + `pg.Pool`，不是传统的 `prisma.$connect()`。所有 pg 相关包必须在 `serverExternalPackages` 中。

3. **Tailwind CSS 4** — 使用 `@tailwindcss/postcss`，不是旧版 Tailwind。CSS 变量模式 (shadcn ui base-nova)。

4. **`src/proxy.ts` 不是 `middleware.ts`** — Next.js 16 的 convention 变更。不要重命名为 middleware.ts。

5. **EdgeOne 部署** — 构建命令: `npx prisma generate && npm run build`，Node 22.11，外部模块列表见 `edgeone.json`。

6. **无 `src/hooks/` 目录** — 但 `components.json` 已配置别名。可以创建。

7. **项目状态追踪** — 见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。每次改完代码后更新其中的"待提交改动"和"最近提交"部分。

---

> **创建日期:** 2026-07-24 | **基于:** 用户确认的开发偏好
