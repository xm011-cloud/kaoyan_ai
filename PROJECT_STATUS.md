# AI 考研助手 — 项目状态

> 最后更新: 2026-07-24 | 分支: `dev` | 维护者: Xm

## 项目概述

面向考研学生的 AI 全栈备考平台。覆盖从目标设定、计划生成、每日学习、刷题练习、错题管理、知识图谱到院校情报的完整考研备考链路。

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 框架 | Next.js App Router (Turbopack) | 16.2.10 |
| 语言 | TypeScript (strict) | 5.x |
| 样式 | Tailwind CSS + shadcn/ui | 4.x |
| 数据库 | PostgreSQL (Neon) + pgvector | — |
| ORM | Prisma (driver adapter: pg Pool) | 6.15.0 |
| 认证/存储 | Supabase / MemFire Cloud (兼容切换) | — |
| AI | MiMo v2.5-pro (OpenAI-compatible API) | — |
| 图表 | Recharts (图表) + D3.js (知识图谱) | 3.x / 7.x |
| 状态管理 | @tanstack/react-query | 5.x |
| 测试 | Playwright | 1.61.x |
| 部署 | EdgeOne Pages + Vercel | — |

## 模块清单 (15 个)

### 🏠 仪表盘 (`/dashboard`)
- 统计卡片：今日任务、本周学习、连续打卡、完成率
- 本周每日柱状图 + 最近打卡列表
- 热力图 (3 月日历) + Recharts 趋势/分布图 (lazy load)
- 图表数据限制近 90 天（避免无限增长）
- 今日任务列表 + 快捷入口
- **文件**: `dashboard/page.tsx`, `components/dashboard-charts.tsx`, `components/stats-charts.tsx`, `components/heatmap.tsx`

### 🎯 目标 (`/goal`)
- 院校/专业/日期/科目/目标分数设定
- AI 一键生成学习计划 (调用 `callAI()` 工具函数)
- 无 AI Key 时本地 fallback 生成
- **API**: `api/goal/route.ts`, `api/ai/generate-plan/route.ts`
- **DB**: Goal 模型 (1:1 User)

### 📋 计划 (`/tasks`)
- 今日视图 + 全部视图切换，任务增删改，完成状态切换

### ✅ 打卡 (`/checkin`)
- 每日学习时长 + 心情 + 备注

### 🍅 番茄钟 (`/pomodoro`)
- 25+5 番茄工作法，SVG 环形计时器，通知+音频，自动同步打卡

### 📚 资料 (`/materials`)
- PDF/TXT 上传 → Supabase Storage → 文本提取 → pgvector 向量化

### 💬 AI 问答 (`/chat`)
- RAG 多轮对话，引用来源，一键加入错题本，Markdown 渲染

### ✏️ 练习 (`/practice`)
- 每日一练 + 模拟考试，AI 判分 (选择自动 + 简答 AI 阅卷)

### 🔴 错题本 (`/wrong-questions`)
- SM-2 间隔重复，批量导入(文本/JSON)，AI 类似题，PDF 导出
- ✅ 已拆分：page.tsx (306行) + add/batch/review/detail 4个弹窗组件
- **筛选已下推数据库**：tag/search 在 Prisma where 层筛选，修复分页 bug

### 📊 反馈 (`/feedback`)
- AI 周报分析 + 练习分数 vs 目标差距

### 🧠 知识图谱 (`/knowledge-graph`)
- D3 力导向图，知识点+关联边，AI 构建，点击查错题

### 🗺️ 学习路径 (`/study-path`)
- AI 生成 4 阶段里程碑，薄弱点分析，进度追踪

### 🏫 院校情报 (`/admission`)
- 四 Tab: 搜索(百度+AI) / 对比(分数矩阵) / 收藏 / **导入(文件/文本/JSON)**

### ⚙️ 设置 (`/settings`)
- AI Key/URL/Model，学习提醒，通知权限

### 📱 PWA (全局)
- manifest + SW 离线缓存 + 安装提示 + 离线页面

## 导航结构

```
🏠 仪表盘 → 🎯 目标 → 📋 计划 → ✅ 打卡 → 🍅 番茄钟
→ 🏫 院校 → 📚 资料 → 💬 AI问答 → 🔴 错题本 → ✏️ 练习
→ 📊 反馈 → 🧠 图谱 → 🗺️ 路径 → ⚙️ 设置
```

## 项目文件结构新增 (本日)

```
src/
├── hooks/                              # 🆕 共享 hooks
│   ├── use-goal.ts                     #    useGoal / useSubjects
│   └── use-wrong-questions.ts          #    CRUD hooks (query + mutation)
├── lib/
│   ├── ai-config.ts                    # 🔧 callAI / extractJson / extractJsonArray
│   ├── api-utils.ts                    # 🆕 handleApiError 统一错误处理
│   ├── date-utils.ts                   # 🆕 startOfDay / getWeekStart / toDateString ...
│   ├── query-provider.tsx              # 🆕 React Query provider
│   └── ...
├── components/
│   └── app-providers.tsx               # 🆕 QueryProvider 包装器
├── app/
│   ├── (authenticated)/
│   │   ├── loading.tsx                 # 🆕 Suspense 加载状态
│   │   └── wrong-questions/
│   │       └── _components/            # 🆕 弹窗拆分
│   │           ├── add-modal.tsx
│   │           ├── batch-import-modal.tsx
│   │           ├── review-modal.tsx
│   │           └── detail-modal.tsx
│   └── api/admission/import/route.ts   # 🆕 院校导入 API
```

## 数据库模型 (19个，无变更)

## API 路由清单 (34 个，+1 import)

| 分类 | 路由数 | 列表 |
|------|--------|------|
| admission | 4 | search, saved, analyze, import |
| ai | 5 | chat, generate-feedback, generate-plan, generate-questions, generate-similar |
| chat | 1 | — |
| checkin | 1 | — |
| feedback | 1 | — |
| goal | 1 | — |
| knowledge-graph | 3 | route, build, node/[id] |
| materials | 2 | route, [id] |
| pomodoro | 2 | sessions, settings |
| practice | 2 | route, [id] |
| questions | 1 | import |
| study-path | 2 | route, progress |
| tasks | 2 | route, [id] |
| upload | 1 | — |
| user | 2 | reminders, settings |
| wrong-questions | 3 | route, [id], batch |

## Key Libraries (src/lib/ — 17 个)

| 文件 | 功能 |
|------|------|
| `api-auth.ts` | 统一认证 (cookie + Bearer token) |
| `api-utils.ts` | 🆕 `handleApiError()` 统一错误处理 |
| `ai-config.ts` | 🔧 AI 配置 + `callAI()` + `extractJson()` |
| `date-utils.ts` | 🆕 `startOfDay/endOfDay/getWeekStart/toDateString/daysAgo` |
| `prisma.ts` | Prisma 单例 (pg Pool driver adapter) |
| `env-config.ts` | 环境配置 (MemFire/Supabase + sslmode 标准化) |
| `rag.ts` | RAG: PDF/TXT 文本提取 + embedding + 相似搜索 |
| `vector.ts` | pgvector 工具 |
| `search.ts` | 百度/SerpAPI/DuckDuckGo 网页搜索 |
| `practice-generator.ts` | 练习题目生成 + fallback |
| `query-provider.tsx` | 🆕 React Query provider |
| `nav.ts` | 侧边栏导航 |
| `utils.ts` | cn() classnames |
| `supabase/*` | Supabase 4 客户端 |

## 本次优化记录 (2026-07-24)

### 修复
- ✅ PostgreSQL sslmode 标准化 (兼容 pg v9)
- ✅ NaN children 防御 (dashboard/stats-charts/knowledge-graph/study-path)
- ✅ 新增 `(authenticated)/error.tsx` 错误边界
- ✅ generate-plan 修复 task.create 缺 subject 字段
- ✅ 错题本 API 筛选从 JS `.filter()` 下推到 Prisma `where` (修复分页 bug)

### 新功能
- ✅ 院校情报手动导入（文件上传 + 文本粘贴 + JSON → AI 提取）

### 重构
- ✅ `callAI()` 统一 6 处 AI 调用 ---- **减 15 行，消 ~100 行重复**
- ✅ `handleApiError()` 统一 14 个 API 路由错误处理
- ✅ `date-utils.ts` 统一 4 处日期计算
- ✅ React Query 基础设施 + `useGoal()`/`useSubjects()` hook (3 页面复用)
- ✅ wrong-questions 页面拆分 (880行 → 306行 + 4组件)
- ✅ Dashboard 图表查询加 90 天 limit
- ✅ 新增 `(authenticated)/loading.tsx` Suspense 边界

### 工程
- ✅ shadcn CLI 移到 devDependencies
- ✅ 添加 `test:e2e` 脚本
- ✅ README.md：启动指南 + 部署步骤 + 10 条开发规则
- ✅ AGENTS.md：AI 自动加载的关键约定
- ✅ PROJECT_STATUS.md：项目全景

## 待优化

| 优先级 | 任务 |
|--------|------|
| P1 | 拆分 practice 页面 (855行) |
| P1 | 错误页面组件提取到 `src/hooks/useWrongQuestions` 替换手动 fetch |
| P2 | 无障碍: htmlFor + aria-label |
| P2 | API 响应 Cache-Control 头 |
| P2 | 补充 E2E 已认证场景测试 |

## 最近提交 (最新→最旧)

```
72b8718 refactor: 拆分 wrong-questions (880→306行+4组件)
db13be8 chore: 抽取 date-utils + 修整依赖/脚本
9806a5b feat: React Query 基础设施 + useGoal/useSubjects
dfd3bf5 refactor: API 错误处理统一 + 错题筛选修复
bfd52d4 refactor: callAI 共用 + dashboard 优化 + loading.tsx
418f7e5 docs: 项目文档 README + AGENTS + PROJECT_STATUS
5e0647e feat: 院校情报手动导入
d298777 fix: sslmode + NaN 防御 + 错误边界
```
