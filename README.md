# C6 · AI 考研学习工作台

> 面向刚起步、学习混乱或基础薄弱的考研学生。C6 把“我想考研”拆成看得见的路线、当周方向与今天的下一步，并把课程、练习、错题和自己的理解串成可回看的学习证据。

**在线体验：** https://c6-orcin.vercel.app · [Apache-2.0](./LICENSE) · 个人项目，核心功能免费

> 线上部署在海外，国内访问可能不稳定。AI 能力使用用户在设置中配置的 OpenAI 兼容 API Key，模型费用由对应服务商按用户自己的 Key 计费。

---

## 它解决什么问题

许多考研学生不是缺一个待办清单，而是缺少一条能持续解释的学习主线：

- 不知道当前先补什么、这周做到什么程度；
- 计划与每天的课程、练习、错题彼此脱节；
- 学过的理解、易错点和解题思路散落在不同笔记里，之后无法复用；
- 计划变化时担心推翻此前努力。

C6 的目标不是替人“自动上岸”，而是让每次学习都能回到同一条可调整、可追溯的路线。

```text
目标与学习档案
  → 阶段路线与里程碑
  → 本周方向与今日任务
  → 课程 / 练习 / 错题复习
  → 我的理解、易错点、解题思路
  → 关联知识节点、积累证据、用户复盘确认
  → 据此安全调整后续计划
```

## V1 核心体验

### 1. 今天知道该做什么，也知道为什么做

- 刚开始时，不必先填完所有长期信息：用备考方向、最需要补的一科与每周可投入时间即可开启 1–3 项“首周探索”任务；
- 从长期目标、当前阶段、里程碑到本周和今日任务形成同一条叙事；
- 首页可直接进入对应课程、练习、任务或复习对象；
- 周计划展示当前服务的阶段目标、退出标准与任务归属，而不是只罗列待办；
- 今日微调、本周调整、长期调整分层处理，已完成记录和历史版本不会被静默改写。

### 2. 在一个连续学习场景里完成课程、练习与复盘

- 课程学习桌整合课程目录、外部课程来源、当前课时、学习记录、自评与 AI 协作；
- 外部课程（如 B 站）以用户授权的新标签页打开，C6 不托管、下载或转码课程视频；
- 练习、错题与间隔复习形成连续流程，错题可按复习到期日回看；
- 番茄钟、打卡与周报用于记录真实学习节奏，而非制造额外打卡负担。

### 3. 沉淀“自己的理解”，而不只是收藏资料

- 学习后记录自己的理解、易错点、可复用的解题方法或思维线索；
- 将记录与系统知识节点、课程、任务、练习和错题关联，逐步形成个人知识脉络；
- 知识节点可查看关联证据和复习线索；知识图谱用于探索关联，不把图形展示误当作掌握证明；
- 资料支持上传、检索和引用，帮助回到原始学习材料。

### 4. AI 是学习管家，不是替你下结论的聊天机器人

- AI 工作区根据当前页面提供计划调整、课时目标、练习提示、错因归纳或资料检索；
- 生成计划前会优先澄清目标、基础、时间容量和阶段标准；建议会说明阶段目标、退出标准和调整影响；
- 任务完成只积累学习证据。是否达成里程碑、继续巩固或需要重学，由用户复盘确认；
- 支持用户自配 OpenAI 兼容模型与自定义技能，也允许把常用的外部 AI 当作并行工具。

## 产品边界

为了先做好学习闭环，当前 V1 **不做**：

- 课程视频托管、转码、下载或绕过第三方平台限制；
- 社区讨论、学习小组或排行榜驱动的社交产品；
- 任意拖拽、自由缩放的“桌面画布”；
- 无纸化手写白板；
- 以高频泛问答为核心的通用 AI 聊天替代品。

这些方向并非没有价值，但应在核心闭环通过真实用户验证后再决定是否投入。

## 当前能力概览

| 学习主线 | 支撑能力 |
| --- | --- |
| 目标与路线 | 目标档案、准备度确认、阶段路线、里程碑、完成证据与复盘确认 |
| 执行与调整 | 周计划草稿/确认、今日任务、分层调整、历史版本与调整影响 |
| 学习场景 | 课程学习桌、外部课程链接、笔记/理解记录、自评、番茄钟与打卡 |
| 练习与复习 | 自定义练习、结果记录、错题本、SM-2 间隔复习、错因与变式题 |
| 知识沉淀 | 个人知识记录、系统知识节点关联、知识图谱、资料上传与检索 |
| AI 与反馈 | 页面上下文 AI 工作区、资料引用、周报、用户自配 Key、技能工作流 |
| 基础能力 | 登录与私有数据隔离、PWA/安全离线队列、数据导出、移动/平板适配 |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Next.js 16（App Router）· TypeScript strict |
| 界面 | Tailwind CSS 4 · shadcn/ui（base-nova） |
| 数据 | PostgreSQL（Neon）+ pgvector · Prisma 6 driver adapter |
| 认证与存储 | Supabase Auth（PKCE）· Supabase Storage（兼容 MemFire 配置） |
| AI | 用户自配 OpenAI 兼容 API Key · Function Calling · RAG |
| 状态与图表 | Zustand · TanStack Query · Recharts · D3 子模块 |
| 部署与测试 | Vercel · Playwright（独立测试数据库） |

## 架构概览

```text
浏览器 / PWA
  → Vercel 上的 Next.js SSR、Server Components 与 API
       ├── Supabase Auth / Storage
       ├── Neon PostgreSQL + pgvector
       ├── 用户自配的 OpenAI 兼容模型
       └── Tavily（可选的院校情报联网检索）
```

## 质量与当前状态

- 全量 Playwright 回归使用独立的 `_test` 数据库与 :3100 开发服务，不污染开发数据；
- 2026-09-29 最近一次全量回归为 **175/175 通过**，耗时 16.3 分钟；完整证据与历史基线见 [`docs/test-baseline.md`](./docs/test-baseline.md)；
- 当前生产地址为 https://c6-orcin.vercel.app；产品范围、已实现能力与待验证项见 [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)。

## 快速开始

### 使用产品

直接访问 https://c6-orcin.vercel.app，注册后先完成目标、基础和可用时间的确认。若要使用 AI，在设置页配置自己的 OpenAI 兼容 API Key。

### 本地开发

```bash
npm install
cp .env.example .env.local
npx prisma db push
npm run dev
```

随后打开 http://localhost:3000。环境变量采用 MemFire 优先、Supabase 回退的统一配置；详细字段见下文和 [`AGENTS.md`](./AGENTS.md)。

## 开发与部署

<details>
<summary><b>环境变量、测试与部署命令</b></summary>

### 常用环境变量

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（也支持 `MEMFIRE_DATABASE_URL`） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL（也支持 MemFire 同名兼容配置） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端使用的 Service Role Key |
| `ADMIN_EMAIL` | 作者后台邮箱；未配置时后台默认拒绝访问 |
| `TAVILY_API_KEY` | 院校情报联网搜索，可选 |

### 校验

```bash
npx tsc --noEmit
npm run lint
npm run build
npx playwright test
```

Playwright 会自动创建独立测试库、同步 schema 并运行在 :3100；认证用例使用 `.env.local` 中的 E2E 测试账号。

### 部署

```bash
npx vercel --prod
```

Vercel 为当前生产方案。国内 EdgeOne Pages 因 Cloud SSR 函数包大小限制暂缓，参见 [`docs/edgeone-deploy.md`](./docs/edgeone-deploy.md)。

</details>

## 协议与反馈

- 代码以 [Apache-2.0](./LICENSE) 开源；
- 产品数据说明见 [隐私政策](https://c6-orcin.vercel.app/privacy) 与 [用户协议](https://c6-orcin.vercel.app/terms)；
- 院校情报保留来源供核验，真题仅供用户个人学习导入；
- 欢迎通过 [意见反馈](https://c6-orcin.vercel.app/suggestions) 提出真实学习场景。

---

持续迭代中。优先级始终是：先让用户清楚今天做什么、为什么做，以及完成后留下了什么证据。
