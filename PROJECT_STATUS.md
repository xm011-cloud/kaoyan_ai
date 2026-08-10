# AI 考研助手 — 项目状态

> 最后更新: 2026-08-10 | 分支: `dev` | 维护者: Xm

## 项目概述

面向考研学生的 AI 全栈备考平台。覆盖从目标设定、计划生成、每日学习、刷题练习、错题管理、知识图谱、院校情报，到学习圈社交（排行榜 + 个人资料）、数据导出与作者激励的完整考研备考链路。封闭邀请制（固定邀请码），单作者业余开发，所有功能免费。

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 框架 | Next.js App Router (Turbopack) | 16.2.10 |
| 语言 | TypeScript (strict) | 5.x |
| 样式 | Tailwind CSS + shadcn/ui | 4.x |
| 数据库 | PostgreSQL (Neon) + pgvector | — |
| ORM | Prisma (driver adapter: pg Pool) | ^6.15.0 |
| 认证/存储 | Supabase Auth (PKCE) / MemFire Cloud (兼容切换) | js ^2.110.2 / ssr ^0.12.0 |
| AI | MiMo v2.5-pro (OpenAI-compatible API) | — |
| 图表 | Recharts + D3 子模块 (知识图谱) | ^3.9.2 / 7.x |
| 状态 | zustand (persist) + @tanstack/react-query | ^5.0.14 / ^5.101.4 |
| 测试 | Playwright (87 用例 → 91 用例) | ^1.61.1 |
| 部署 | Vercel (c6-orcin.vercel.app) | — |

## 模块清单 (19 个)

### 📅 今日组

#### 🏠 概览 (`/dashboard`)
- 统计卡片、热力图、趋势图、今日任务；查询 Set/Map 单遍历派生（6→2 查询），图表限 90 天

#### ✅ 打卡 (`/checkin`)
- 每日学习时长 + 心情 + 备注（排行榜/资料页数据源）

#### 🍅 番茄钟 (`/pomodoro`)
- 25+5 番茄工作法，SVG 环形计时器，反漂移引擎，通知+音频，后台自动保存，ActivityBar 交互控制

#### 🏆 学习圈 (`/leaderboard`) — 🆕 2026-08-10
- 打卡累计时长排名（并列按时长天数），本周/本月/全部周期切换
- 领奖台前三 + 列表 + 我的排名；成员点击进公开资料页
- **API**: `api/leaderboard/route.ts`（groupBy 两步聚合 + User join，邮箱脱敏）

### 📝 备考组

#### 🎯 目标 (`/goal`)
- 院校/专业/日期/科目/目标分数 + 科目标准化选择器（12 统考 preset + 自主命题）

#### 📋 计划 (`/tasks`) — 备考规划中心
- 3 阶段卡片 + 各科进度；周计划生成 → AI 评审 → 采纳循环；冲刺模式（<30 天 🔥 横幅）；周计划到期提醒

#### ✏️ 练习 (`/practice`)
- 每日一练 + 模拟考试，5 种出题模式，AI 判分；React Query hooks + 定时器 hook

#### 📕 错题本 (`/wrong-questions`)
- SM-2 间隔重复，批量导入，AI 类似题，PDF 导出，URL 参数筛选恢复

### 🤖 AI 组

#### 💬 AI 对话 (`/chat`)
- RAG 多轮对话，引用来源，加入错题本，Markdown 渲染

#### 📊 周报 (`/feedback`)
- AI 周报分析 + 练习分数 vs 目标差距

#### 🗺️ 学习路径 (`/study-path`)
- AI 生成 4 阶段里程碑，薄弱点分析，进度追踪

### 📚 知识组

#### 📖 资料 (`/materials`)
- PDF/TXT 上传 → Supabase Storage → 文本提取 → pgvector 向量化

#### 🧠 知识图谱 (`/knowledge-graph`)
- D3 力导向图（5 模块 tree-shaking ~3.8MB），知识点 + 关联边，AI 构建

#### 🏫 院校情报 (`/admission`)
- 后端完成（search/analyze/saved/import），前端默认隐藏，待启用

### ⚙️ 设置组

#### 👤 个人资料 (`/profile`) — 🆕 2026-08-10
- 昵称编辑 + 头像上传（public `avatars` 桶，≤2MB，JPG/PNG/WebP/GIF）
- **公开资料页** `/user/[id]`：查看他人昵称/头像/打卡统计（累计/本周/连续），**不暴露 email**
- **API**: `api/user/profile/route.ts`（GET 自己/公开视图 + PUT 昵称）、`api/user/avatar/route.ts`（上传 + best-effort 清理旧图）

#### ⚙️ 设置 (`/settings`)
- AI Key/URL/Model，学习提醒，界面定制（导航分组/工作台卡片/出题偏好），数据导出

### 🆕 公开 / 运营模块 (2026-08-10)

#### ☕ 支持作者 (`/support`，公开)
- 请作者喝咖啡 ¥9.9，微信/支付宝收款码图，留言 + 感谢墙（**审核后展示**）
- **API**: `api/support/route.ts`（蜜罐 + 限流 3/min/IP + 强制金额）

#### 💬 意见反馈 (`/suggestions`)
- 1-5 星 + 意见 + 匿名开关（需登录）；`api/suggestions/route.ts`

#### 🔒 作者后台 (`/admin`)
- 意见反馈 / 支持留言审核 / 重置密码三 Tab；`ADMIN_EMAIL` env 校验（fail closed）
- **API**: `api/admin/*`（feedback 状态流转、support 审核/删除、users/reset-link）
- **重置链接**：`generateLink`→`hashed_token` 自建链接，跨浏览器免邮件（PKCE 下 action_link 不可用的替代通道）

#### 📄 认证页
- `/login`（邀请码注册/登录）、`/forgot-password`、`/update-password`、`/auth/callback`（双模式：PKCE code 交换 + token_hash verifyOtp）、`/`（落地页 8 功能卡）、`/about`

## 导航结构（Header 5 分组）

```
📅 今日 → 🏠概览 / ✅打卡 / 🍅番茄钟 / 🏆学习圈
📝 备考 → 🎯目标 / 📋计划 / ✏️练习 / 📕错题
🤖 AI   → 💬对话 / 📊周报 / 🗺️路径
📚 知识 → 📖资料 / 🧠图谱 / 🏫院校(默认隐藏)
⚙️ 设置 → ⚙️偏好 / 👤个人资料
```

## 关键文件结构

```
src/
├── lib/
│   ├── admin.ts                       # requireAdmin（ADMIN_EMAIL env，fail closed）
│   ├── api-auth.ts                    # getAuthUser / ensureLocalUser
│   ├── api-utils.ts                   # jsonNoStore / handleApiError
│   ├── rate-limit.ts                  # 🆕 限流 + 蜜罐 + IP 提取（register/support 复用）
│   ├── ai-config.ts / ai-tools.ts     # callAI / AI 工具调用（9 个）
│   ├── nav.ts                         # defaultNavGroups 分组导航 + navItems
│   ├── supabase/*                     # server / client / service / middleware(updateSession)
│   ├── date-utils.ts / time-utils.ts  # getWeekStart / startOfDay ...
│   └── rag.ts / vector.ts / search.ts # RAG + 向量 + 搜索
├── components/
│   ├── avatar.tsx                     # 🆕 可复用头像（首字符 fallback）
│   ├── shell.tsx / header.tsx / mobile-nav.tsx   # OS 外壳（TopBar/TabBar/ActivityBar/MobileNav）
│   ├── pomodoro-engine.tsx / pomodoro-timer.tsx  # 番茄钟引擎
│   ├── ai-floating.tsx                # 🆕 AI 浮动面板（Function Calling）
│   └── weekly-plan-reminder.tsx       # 周计划到期提醒
├── stores/
│   └── ui-store.ts                    # navGroups/workspaceCards/practiceDefaults (persist v1)
└── app/
    ├── (authenticated)/               # 18 页 + layout（服务端鉴权兜底）
    │   ├── leaderboard/  profile/  user/[id]/  suggestions/
    │   └── ...
    ├── admin/  support/  suggestions/   # 公开或 admin
    ├── login/  forgot-password/  update-password/
    ├── auth/callback/route.ts           # 🆕 双模式回调
    └── api/                             # 47 个路由
```

## API 路由清单 (47 个)

| 分类 | 路由 |
|------|------|
| ai (6) | chat, generate-feedback, generate-plan, generate-questions, generate-similar, judge-plan |
| admission (4) | search, analyze, saved, import |
| auth (1) | register（蜜罐+限流+邀请码，另有 `/auth/callback`、`/auth/signout` 为 app 路由） |
| admin (5) | feedback, feedback/[id], support, support/[id], users/reset-link |
| leaderboard (1) | route |
| user (5) | profile, avatar, export, reminders, settings |
| support/suggestions (2) | support, suggestions |
| 核心业务 | chat, checkin, feedback, goal, tasks(+[id]), materials(+[id]), upload, practice(+[id]), wrong-questions(+[id],batch), questions/import, pomodoro/sessions+settings, knowledge-graph(+build,node/[id]), study-path(+progress), progress/summary |

## 数据库模型变更

| 模型 | 新增字段 / 说明 | 时间 |
|------|------|------|
| Task | `weekStartDate` + `source` + `@@index([userId, weekStartDate])` | 2026-07-28 |
| Goal | `progress` (Json) | 2026-07-28 |
| **Supporter** | 🆕 感谢墙留言：`userId?/name/amount/message/approved/createdAt`（审核制） | 2026-08-10 |
| **AuthorFeedback** | 🆕 意见反馈：`userId/rating/content/anonymous/status`（new→read→resolved） | 2026-08-10 |

## 近期迭代记录 (2026-08)

### 第 1 轮 — OS 外壳 + 体验修复（8 月上旬，已提交）
- Apple HIG UI 全面优化 + OS 外壳布局（TopBar/TabBar/ActivityBar/MobileNav）
- 番茄钟引擎反漂移 + 后台自动保存 + ActivityBar 交互控制
- AI 助手 Function Calling：全局浮动面板 + 9 个工具调用（`src/components/ai-floating.tsx` + `src/lib/ai-tools.ts`）
- 导航分组重构（今日/备考/AI/知识/设置）+ 页面标题统一

### 第 2 轮 — 注册/留存/合规（8 月上旬，已提交）
- 固定邀请码注册：蜜罐 + 生产限流 5/min/IP + `crypto.timingSafeEqual` 校验 + `admin.createUser({email_confirm:true})`
- 周计划到期提醒 + 冲刺模式（<30 天 🔥）+ PWA 完善（manifest/icon/offline）
- **Supabase 手动步骤**：控制台关闭 "Allow new users to sign up"（已由用户完成）

### 第 3 轮 — 落地页 + 作者激励 + 反馈后台（2026-08-10，已部署）
- 落地页 8 功能卡 + footer 链接；`/support` 公开（收款码 + 留言 + 审核上墙）；`/suggestions` 需登录（1-5 星 + 匿名）；`/admin` 作者后台（`ADMIN_EMAIL` fail closed）
- 限流/蜜罐提取为 `src/lib/rate-limit.ts`；新模型 Supporter + AuthorFeedback
- **Vercel env**：`ADMIN_EMAIL=2033755532@qq.com`；收款码图 `public/payment/wechat.png` + `alipay.jpg`

### 第 4 轮 — 账号安全 + 学习圈 + 数据主权（2026-08-10，已部署）
- **忘记密码**：双模式回调（PKCE code / token_hash verifyOtp）+ `/forgot-password` 公开页 + `/update-password` 会话保护 + 管理员重置链接兜底
  - **手动步骤**：Supabase Redirect URLs 加 `/auth/callback`（localhost + 生产）；可选邮件模板改 token_hash 直链
- **学习圈排行榜**：打卡时长排名 + 领奖台 + 周期切换 + 导航同步
- **数据导出**：设置页一键导出全部学习数据 JSON（排除 Chat 与 Material 内容）

### 第 5 轮 — 个人资料（2026-08-10，已部署）
- `/profile` 昵称 + 头像（public `avatars` 桶，首个 public 桶）+ 排行榜头像联动 + `/user/[id]` 公开资料页（不暴露 email）
- 无需数据库迁移（name/avatar 字段早已存在）；无控制台手动步骤

## 待优化

| 优先级 | 任务 |
|--------|------|
| P1 | 院校情报 (`/admission`) 前端启用（ui-store `visible:false`→true；**待用户决定是否接付费 SerpAPI**，Vercel+百度反爬风险） |
| P1 | 数据库迁移到生产环境（当前 Neon 免费档） |
| P2 | 模块联动（页面间上下文链接，消除死胡同模块） |
| P2 | 无障碍: htmlFor + aria-label 完善 |
| P2 | PWA 离线策略优化（导航网络优先，仅 offline.html 兜底，未缓存 API 数据） |
| P3 | 学习圈：点赞/互关/动态等更深社交（当前仅排行榜） |

## 最近提交 (最新→最旧)

```
d8c8548 feat: 学习圈联动 — 排行榜头像 + 点击进公开资料页 + 导航新增个人资料
5c05897 feat: 个人资料 — 昵称编辑 + 头像上传(public avatars 桶) + 公开资料页
2889758 feat: 数据导出 — 一键导出全部学习数据 JSON + 设置页下载按钮
027f8eb feat: 学习圈排行榜 — 打卡时长排名 + 领奖台 + 导航同步
d5a1bd9 feat: 忘记密码 — 双模式回调 + 公开页 + 管理员重置链接兜底
4196c50 test: 新增支持/反馈/后台 E2E 用例
f69c061 feat: 前置落地页 + 支持页 + 反馈页 + 作者后台
a857105 feat: 支持作者 + 意见反馈 — 数据模型与 API
935a3f7 feat: 登录注册 — 固定邀请码 + 注册即用
2bd7022 feat: 周计划到期提醒 + 冲刺模式 + PWA 完善
1db54a9 fix: 番茄钟引擎反漂移 + Practice 恢复进行中会话 + Dashboard 今日概览
955d993 refactor: 导航分组重构 — 今日/备考/AI/知识 + 页面标题统一
7a67c08 feat: AI 助手 Function Calling — 全局浮动面板 + 9 个工具调用
1c05ccc fix: 番茄钟后台自动保存 + ActivityBar 交互控制
43eaa58 fix: 全面修复 — 计时引擎 + 状态同步 + 设计还原
f6c9329 fix: ActivityBar 始终可见 + 移动端统一底部栏
c87ba50 refactor: Apple HIG UI 全面优化
9b9ca58 feat: OS 外壳布局 — TopBar + TabBar + ActivityBar + MobileNav
```

## 测试

- Playwright 91 用例全绿（authenticated + unauthenticated 双项目，per-project testMatch）
- 覆盖：全部模块页面 + 认证重定向 + PWA 资源 + 权限（admin/suggestions/profile 403/重定向）+ 导出下载 + 头像上传 + 排行榜点击进公开页
- 注意：`e2e/.auth/user.json` 为测试账号存储态；E2E 会写少量测试数据（打卡/昵称/头像）到 dev 库
