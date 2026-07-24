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
| 测试 | Playwright | 1.61.x |
| 部署 | EdgeOne Pages + Vercel | — |

## 模块清单 (15 个)

### 🏠 仪表盘 (`/dashboard`)
- 统计卡片：今日任务、本周学习、连续打卡、完成率
- 本周每日柱状图 + 最近打卡列表
- 热力图 (3 月日历) + Recharts 趋势/分布图 (lazy load)
- 今日任务列表 + 快捷入口
- **文件**: `dashboard/page.tsx` (257行), `components/dashboard-charts.tsx`, `components/stats-charts.tsx`, `components/heatmap.tsx`

### 🎯 目标 (`/goal`)
- 院校/专业/日期/科目/目标分数设定
- AI 一键生成学习计划 (调用 `/api/ai/generate-plan`)
- 无 AI Key 时本地 fallback 生成
- **API**: `api/goal/route.ts`, `api/ai/generate-plan/route.ts`
- **DB**: Goal 模型 (1:1 User)

### 📋 计划 (`/tasks`)
- 今日视图 + 全部视图切换
- 任务增删改、完成状态切换
- 阶段筛选 + 进度条
- **API**: `api/tasks/route.ts`, `api/tasks/[id]/route.ts`
- **DB**: Task 模型

### ✅ 打卡 (`/checkin`)
- 每日学习时长 + 心情 (好/一般/累) + 备注
- **API**: `api/checkin/route.ts`
- **DB**: CheckIn 模型 (userId+date 唯一)

### 🍅 番茄钟 (`/pomodoro`)
- 25+5 番茄工作法，SVG 环形计时器
- 通知 + 音频提醒，自动同步打卡
- 设置面板 + 历史记录
- **组件**: `components/pomodoro-timer.tsx`, `components/pomodoro-settings.tsx`, `components/pomodoro-history.tsx`
- **DB**: PomodoroSession 模型, User 上的 pomodoro 设置字段

### 📚 资料 (`/materials`)
- PDF/TXT/图片 上传，Supabase Storage
- 自动文本提取 + pgvector 向量化 (非阻塞)
- 列表/删除/内容查看
- **API**: `api/materials/route.ts`, `api/materials/[id]/route.ts`, `api/upload/route.ts`
- **DB**: Material 模型 (含 pgvector embedding)

### 💬 AI 问答 (`/chat`)
- RAG 多轮对话，引用来源资料
- 一键加入错题本
- Markdown 渲染 (react-markdown)
- **API**: `api/chat/route.ts`, `api/ai/chat/route.ts`
- **DB**: Chat 模型

### ✏️ 练习 (`/practice`)
- 每日一练 + 模拟考试
- 按资料/薄弱点选题，AI 生成题目
- 自动判分 + 分数统计
- **API**: `api/practice/route.ts`, `api/practice/[id]/route.ts`, `api/ai/generate-questions/route.ts`
- **DB**: PracticeSession 模型

### 🔴 错题本 (`/wrong-questions`)
- SM-2 间隔重复算法
- 批量导入 (文本/JSON 两种格式)
- AI 生成类似题
- 标签筛选、搜索、分页
- **API**: `api/wrong-questions/route.ts`, `api/wrong-questions/[id]/route.ts`, `api/wrong-questions/batch/route.ts`, `api/ai/generate-similar/route.ts`
- **DB**: WrongQuestion 模型 (SM-2 字段: easeFactor, interval, nextReviewDate)
- ⚠️ 文件最大 (886行)，建议拆分

### 📊 反馈 (`/feedback`)
- AI 周报分析
- 练习分数 vs 目标差距对比
- **API**: `api/feedback/route.ts`, `api/ai/generate-feedback/route.ts`
- **DB**: Feedback 模型

### 🧠 知识图谱 (`/knowledge-graph`)
- D3 力导向图可视化
- 知识点节点 + 关联边
- 点击查看详情 + 关联错题
- AI 构建图谱
- **API**: `api/knowledge-graph/route.ts`, `api/knowledge-graph/build/route.ts`, `api/knowledge-graph/node/[id]/route.ts`
- **DB**: KnowledgeNode + KnowledgeEdge 模型

### 🗺️ 学习路径 (`/study-path`)
- AI 生成分阶段里程碑
- 薄弱点分析，加权生成
- 进度 slider + checkbox
- **API**: `api/study-path/route.ts`, `api/study-path/progress/route.ts`
- **DB**: StudyPath + StudyPathMilestone 模型

### 🏫 院校情报 (`/admission`)
- 四 Tab: 搜索 / 对比 / 收藏 / 导入
- 搜索: 百度爬虫 + AI 提取结构化录取数据
- 导入: 文件上传(TXT/PDF) 或文本/JSON 粘贴 → AI 提取
- 对比: 多院校分数矩阵 + AI 匹配度分析
- **API**: `api/admission/search/route.ts`, `api/admission/saved/route.ts`, `api/admission/analyze/route.ts`, `api/admission/import/route.ts`
- **DB**: AdmissionInfo + SchoolComparison 模型

### ⚙️ 设置 (`/settings`)
- AI Key/URL/Model 配置
- 学习提醒时间/日期/开关
- 浏览器通知权限
- **API**: `api/user/settings/route.ts`, `api/user/reminders/route.ts`
- **DB**: User 模型上的 aiKey/aiUrl/aiModel/reminder* 字段

### 📱 PWA (全局)
- manifest.json + Service Worker 离线缓存
- 安装提示组件
- 离线 fallback 页面
- **文件**: `public/manifest.json`, `public/sw.js`, `public/offline.html`, `components/pwa-install.tsx`

## 导航结构

```
🏠 仪表盘 → 🎯 目标 → 📋 计划 → ✅ 打卡 → 🍅 番茄钟
→ 🏫 院校 → 📚 资料 → 💬 AI问答 → 🔴 错题本 → ✏️ 练习
→ 📊 反馈 → 🧠 图谱 → 🗺️ 路径 → ⚙️ 设置
```

## 数据库模型 (19 个)

| 模型 | 记录数 | 关键索引 |
|------|--------|---------|
| User | 核心 | email 唯一 |
| Goal | 1:1 User | userId 唯一 |
| Task | N:1 User | (userId, date) |
| CheckIn | N:1 User | (userId, date) 唯一 |
| Material | N:1 User | userId |
| Chat | N:1 User | userId |
| Feedback | N:1 User | (userId, weekStart) |
| WrongQuestion | N:1 User | (userId, subject), (userId, nextReviewDate) |
| PracticeSession | N:1 User | (userId, type/status/createdAt) |
| PomodoroSession | N:1 User | (userId, createdAt) |
| AdmissionInfo | N:1 User (nullable) | (university, major, year, category) 唯一 |
| ImportedQuestion | N:1 User | (userId, subject/year) |
| SchoolComparison | N:1 User | — |
| KnowledgeNode | N:1 User | (userId, name, subject) 唯一 |
| KnowledgeEdge | — | (fromId, toId) 唯一 |
| StudyPath | 1:1 User | userId 唯一 |
| StudyPathMilestone | N:1 StudyPath | (studyPathId, order) |

## API 路由清单 (33 个)

**admission** (4): search, saved, analyze, import
**ai** (5): chat, generate-feedback, generate-plan, generate-questions, generate-similar
**chat** (1): chat
**checkin** (1): checkin
**feedback** (1): feedback
**goal** (1): goal
**knowledge-graph** (3): route, build, node/[id]
**materials** (2): route, [id]
**pomodoro** (2): sessions, settings
**practice** (2): route, [id]
**questions** (1): import
**study-path** (2): route, progress
**tasks** (2): route, [id]
**upload** (1): upload
**user** (2): reminders, settings
**wrong-questions** (3): route, [id], batch

## Key Libraries (src/lib/ — 14 个)

| 文件 | 功能 |
|------|------|
| `api-auth.ts` | 统一认证 (cookie + Bearer token 双通道) |
| `ai-config.ts` | AI 配置解析 (用户自定义 / 全局环境变量) |
| `prisma.ts` | Prisma 单例 (pg Pool driver adapter) |
| `env-config.ts` | 环境配置 (MemFire / Supabase 双后端 + sslmode 标准化) |
| `rag.ts` | RAG: PDF/TXT 文本提取 + pgvector embedding + 相似搜索 |
| `vector.ts` | pgvector 工具: storeEmbedding / searchByVector / ensureEmbeddings |
| `search.ts` | 百度/SerpAPI/DuckDuckGo 网页搜索 |
| `practice-generator.ts` | 练习题目 AI 生成 + 本地 fallback |
| `nav.ts` | 侧边栏导航配置 |
| `utils.ts` | cn() classnames 合并 |
| `supabase/` | Supabase client (client/server/service/middleware) |

## 已知问题 & 待优化

详见上次代码审查结论，高优先级:
1. 无服务端状态管理 (React Query)
2. 零 loading.tsx 文件
3. 巨型页面组件需拆分 (wrong-questions 886行, practice 855行)
4. AI 调用逻辑 5 处重复
5. Dashboard 全量查询 (无 limit)

## 最近提交

```
6ecea2b fix: simplify build — drop standalone
eeb01fc fix: externalize prisma/pg/react-markdown
362362b fix: remove pdf2json, move prisma to devDeps (save ~80MB)
742f52d fix: migrate middleware.ts to proxy.ts (Next.js 16)
f5b6dac fix: externalize heavy server packages from EdgeOne bundle
```

## 待提交改动 (当前 diff)

- PostgreSQL sslmode 标准化 (`env-config.ts`)
- NaN children 防御 (dashboard, stats-charts, knowledge-graph, study-path)
- 院校情报导入功能 (admission/import API + ImportTab 组件)
- `src/app/(authenticated)/error.tsx` (新增)
