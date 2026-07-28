# AI 考研助手 — 项目状态

> 最后更新: 2026-07-28 | 分支: `dev` | 维护者: Xm

## 项目概述

面向考研学生的 AI 全栈备考平台。覆盖从目标设定、计划生成、每日学习、刷题练习、错题管理、知识图谱到院校情报的完整考研备考链路。

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 框架 | Next.js App Router (Turbopack) | 16.2.10 |
| 语言 | TypeScript (strict) | 5.x |
| 样式 | Tailwind CSS + shadcn/ui | 4.x |
| 数据库 | PostgreSQL (Neon) + pgvector | — |
| ORM | Prisma (driver adapter: pg Pool) | 6.19.3 |
| 认证/存储 | Supabase / MemFire Cloud (兼容切换) | — |
| AI | MiMo v2.5-pro (OpenAI-compatible API) | — |
| 图表 | Recharts (图表) + D3 子模块 (知识图谱) | 3.x / 7.x |
| 状态管理 | @tanstack/react-query | 5.x |
| 测试 | Playwright | 1.61.x |
| 部署 | EdgeOne Pages + Vercel | — |

## 模块清单 (15 个)

### 🏠 仪表盘 (`/dashboard`)
- 统计卡片、本周柱状图、连续打卡、热力图、趋势图
- ✅ 6 查询 → 2 查询 (Set/Map 派生)；图表限 90 天
- **文件**: `dashboard/page.tsx`, `components/dashboard-charts.tsx`, `components/stats-charts.tsx`, `components/heatmap.tsx`

### 🎯 目标 (`/goal`)
- 院校/专业/日期/科目/目标分数 + **科目标准化选择器**
- ✅ textarea → 预设 checkbox (12 统考科目) + 自主命题输入 (院校+科目名)
- ✅ 保存后「管理学习计划」按钮 → `/tasks`
- **组件**: `goal/_components/subject-selector.tsx`
- **API**: `api/goal/route.ts`

### 📋 计划 (`/tasks`) — 🆕 重构为备考规划中心
- **阶段概览**: 3 阶段卡片 (基础/强化/冲刺) 自动计算日期 + 当前标识
- **各科进度**: 手动输入 % + 备注，旁边展示系统数据 (掌握度/错题/练习分) 参考
- **周计划核心**: 生成 → 评审 → 采纳建议重新生成 → 循环
  - 7 天日视图，支持单天重新生成、手动添加/编辑/删除
  - 周选择器切换历史周
- **组件**: `tasks/_components/weekly-planner.tsx`
- **API**: `api/ai/generate-plan/route.ts` (支持 progress/judgeFeedback/regenerateDay), `api/ai/judge-plan/route.ts`

### ✅ 打卡 (`/checkin`)
- 每日学习时长 + 心情 + 备注

### 🍅 番茄钟 (`/pomodoro`)
- 25+5 番茄工作法，SVG 环形计时器，通知+音频
- ✅ formatTime 改用共享 `lib/time-utils.ts`

### 📚 资料 (`/materials`)
- PDF/TXT 上传 → Supabase Storage → 文本提取 → pgvector 向量化

### 💬 AI 问答 (`/chat`)
- RAG 多轮对话，引用来源，一键加入错题本，Markdown 渲染

### ✏️ 练习 (`/practice`)
- 每日一练 + 模拟考试，AI 判分
- ✅ 854 行 → 365 行 + 3 组件 (SessionCreator / ActiveSession / ResultView)
- ✅ 手动 fetch → React Query hooks (usePracticeSessions/useCreatePracticeSession/useSubmitPracticeSession)
- ✅ 定时器提取为 `hooks/use-practice-timer.ts`
- **组件**: `practice/_components/` (3 个)

### 🔴 错题本 (`/wrong-questions`)
- SM-2 间隔重复，批量导入，AI 类似题，PDF 导出
- ✅ 页面拆分 (306行) + 4 弹窗 (add/batch/review/detail)
- ✅ 手动 fetch → React Query hooks (全部 5 个 hook 已接入)
- ✅ 筛选下推 Prisma where

### 📊 反馈 (`/feedback`)
- AI 周报分析 + 练习分数 vs 目标差距

### 🧠 知识图谱 (`/knowledge-graph`)
- D3 力导向图，知识点 + 关联边，AI 构建
- ✅ `import * as d3` → 5 独立模块 (tree-shaking ~3.8MB)

### 🗺️ 学习路径 (`/study-path`)
- AI 生成 4 阶段里程碑，薄弱点分析，进度追踪

### 🏫 院校情报 (`/admission`)
- 四 Tab: 搜索 / 对比 / 收藏 / 导入 (文件/文本/JSON)

### ⚙️ 设置 (`/settings`)
- AI Key/URL/Model，学习提醒，通知权限

---

## 导航结构

```
🏠 仪表盘 → 🎯 目标 → 📋 计划 → ✅ 打卡 → 🍅 番茄钟
→ 🏫 院校 → 📚 资料 → 💬 AI问答 → 🔴 错题本 → ✏️ 练习
→ 📊 反馈 → 🧠 图谱 → 🗺️ 路径 → ⚙️ 设置
```

---

## 文件结构

```
src/
├── hooks/
│   ├── use-goal.ts                       # useGoal / useSubjects (含 progress 类型)
│   ├── use-wrong-questions.ts            # CRUD hooks (5 个，已全部接入页面对接)
│   ├── use-practice.ts                   # 🆕 usePracticeSessions / useCreate / useSubmit
│   └── use-practice-timer.ts             # 🆕 练习定时器 (倒计时 + 正计时)
├── lib/
│   ├── ai-config.ts                      # callAI / extractJson / extractJsonArray
│   ├── api-auth.ts                       # 统一认证
│   ├── api-utils.ts                      # handleApiError
│   ├── date-utils.ts                     # startOfDay / endOfDay / getWeekStart ...
│   ├── time-utils.ts                     # 🆕 formatTime (mm:ss)
│   ├── practice-types.ts                 # 🆕 PracticeQuestion / PracticeSession (前后端共享)
│   ├── subject-standards.ts              # 🆕 科目标准化 (预设 + alias + 自主前缀)
│   ├── practice-generator.ts             # 练习题目生成
│   ├── query-provider.tsx                # React Query provider (gcTime 30min)
│   ├── prisma.ts                         # Prisma 单例
│   ├── env-config.ts                     # 环境配置
│   ├── rag.ts / vector.ts / search.ts    # RAG + 向量 + 搜索
│   ├── nav.ts / utils.ts                 # 导航 / cn()
│   └── supabase/*                        # Supabase 客户端
├── components/
│   └── app-providers.tsx                 # QueryProvider
├── app/
│   ├── (authenticated)/
│   │   ├── goal/
│   │   │   ├── page.tsx                  # 简化：只设目标 + 跳转按钮
│   │   │   └── _components/
│   │   │       └── subject-selector.tsx  # 🆕 科目选择器 (checkbox + 自主输入)
│   │   ├── tasks/
│   │   │   ├── page.tsx                  # 🆕 重写：四区备考中心
│   │   │   └── _components/
│   │   │       └── weekly-planner.tsx    # 🆕 周计划组件 (日视图 + 评审 + 生成)
│   │   ├── practice/
│   │   │   ├── page.tsx                  # ✅ 854→365 行
│   │   │   └── _components/             # 🆕 3 组件
│   │   │       ├── session-creator.tsx
│   │   │       ├── active-session.tsx
│   │   │       └── result-view.tsx
│   │   └── wrong-questions/
│   │       ├── page.tsx                  # ✅ React Query 迁移
│   │       └── _components/             # ✅ 4 弹窗 (add/batch/review/detail)
│   └── api/
│       ├── ai/
│       │   ├── generate-plan/route.ts    # 🔧 周计划 + progress + judge feedback + 单天重生成
│       │   └── judge-plan/route.ts       # 🆕 AI 评审 + 本地规则 fallback
│       ├── progress/summary/route.ts     # 🆕 各科进度汇总 (知识图谱/错题/练习/任务)
│       ├── goal/route.ts                 # 🔧 POST/PUT 支持 progress 字段
│       ├── tasks/route.ts                # 🔧 GET 支持 weekStart/subject 查询
│       └── ...
```

---

## API 路由清单 (50 个)

| 分类 | 路由 | 变更 |
|------|------|------|
| ai | chat, generate-feedback, **generate-plan**, generate-questions, generate-similar, **judge-plan** | +1 (judge-plan), 🔧 generate-plan |
| admission | search, saved, analyze, import | — |
| task | **route (🔧)**, [id] | +weekStart/subject 查询参数 |
| goal | **route (🔧)** | +progress 字段 |
| progress | **summary** | 🆕 进度汇总 |
| practice | route, [id] | — |
| wrong-questions | route, [id], batch | — |
| knowledge-graph | route, build, node/[id] | — |
| 其他 | chat, checkin, feedback, materials×2, pomodoro×2, questions, study-path×2, upload, user×2 | — |

---

## 数据库模型变更 (2026-07-28)

| 模型 | 新字段 | 说明 |
|------|--------|------|
| Task | `weekStartDate` (DateTime?) | 所属周开始日期 |
| Task | `source` (String?) | "ai" / "manual" |
| Task | `@@index([userId, weekStartDate])` | 按周查询索引 |
| Goal | `progress` (Json?) | `{"数学一":{"percent":80,"note":"高数第三章"}}` |

---

## 本次优化记录 (2026-07-28)

### 性能优化
- ✅ D3 tree-shaking：全量包 → 5 独立模块 (减 ~3.8MB)
- ✅ Dashboard 查询合并：6→2 (Set/Map 单遍历派生)
- ✅ Practice 定时器 ref 优化 (每 5s setState 替代每秒)
- ✅ KnowledgeGraph: Promise.all → prisma.$transaction 批量 upsert
- ✅ WrongQuestions: 删除冗余 useEffect 双重加载
- ✅ Shadcn CSS 抽取到 `src/styles/shadcn-tailwind.css`

### 学习计划系统重构
- ✅ **科目标准化**: 12 统考 preset + 自主命题前缀 + normalize + alias + legacy 可见
- ✅ **周计划生成**: 增量模式 (保留已完成/手动任务) + 每天 3-5 会话
- ✅ **计划评判家**: AI 独立审查 (score/issues/verdict) + 本地规则 fallback
- ✅ **进度系统**: 手动输入 (每科 % + 备注) + 系统数据参考 (掌握度/错题/练习分)
- ✅ Goal 页面: textarea → SubjectSelector + 简化流程 → [管理计划] 按钮
- ✅ **Tasks 页面**: 全面重写为四区备考规划中心

### 代码治理
- ✅ Practice 拆分：854→365 行 + 3 组件 + 2 hooks + 2 共享 lib
- ✅ WrongQuestions React Query 迁移：全部 5 个 hook 接入 + 手动 fetch 清除
- ✅ Practice React Query 接入：手动 fetch → usePracticeSessions/Create/Submit
- ✅ Pomodoro formatTime → 共享 `lib/time-utils.ts`
- ✅ `/api/subjects` 死代码删除
- ✅ SubjectSelector legacy 科目 ghost entries 可见 + 黄色标记
- ✅ Prisma 7 月更新至 v6.19.3

### 工程
- ✅ PROJECT_STATUS.md 更新

---

## 待优化

| 优先级 | 任务 |
|--------|------|
| P1 | 状态持久化 (Practice/Chat/Pomodoro 导航丢失恢复) |
| P1 | 模块联动 (页面间上下文链接，消除死胡同模块) |
| P2 | URL 参数持久化筛选状态 (WrongQuestions/Tasks) |
| P2 | 无障碍: htmlFor + aria-label |
| P2 | API 响应 Cache-Control 头 |
| P2 | 补充 E2E 已认证场景测试 |

---

## 最近提交 (最新→最旧)

```
09d7813 fix: Prisma 重新生成 + 修复 weekStartDate 时区 bug
a14093f feat: 任务页面重构为备考规划中心 + Goal简化 + 进度系统
d8846dc feat: 学习计划重构 + Practice拆分 + React Query迁移
bac3f56 perf: D3 tree-shaking + Dashboard 查询合并 + 定时器 ref 优化
07339c4 docs: 更新 PROJECT_STATUS — 同步所有优化记录和项目现状
72b8718 refactor: 拆分 wrong-questions 页面 (880行→306行+4组件)
```
