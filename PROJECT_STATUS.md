# AI 考研助手 — 项目状态

> 最后更新: 2026-08-14 | 分支: `dev` | 维护者: Xm

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
| 测试 | Playwright 102 用例 · 独立测试库 `neondb_test` | ^1.61.1 |
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
- RAG 多轮对话，引用来源，加入错题本，Markdown 渲染；技能运行宿主（?skill= 启动 / 斜杠菜单 / 运行徽标 + 结束技能）；等待安抚气泡（分阶段文案 + 预估秒数 + 可取消）

#### ⚡ 技能 (`/skills`) — 🆕 2026-08-13
- **用户自定义工作流层**：页面覆盖通用需求，技能让用户自组"数据快照 + 提问 + AI 指令 + 档案 + 收尾"的完整流程
- 3 内置模板惰性播种（每日复盘🌅 / 错题变式训练🎯 / 费曼抽查💬），可编辑/删除；技能架卡片网格（icon/描述/触发关键词/运行次数/档案条数）
- **技能运行 = 带 skillId 的对话**：复用 /api/ai/chat tool-calling 循环，注入数据快照 + 流程 prompt + 档案 note；`skill_control` 工具（note_append/finish）仅技能运行注入
- **技能档案（note）**：跨会话累积，技能越用越有价值；收尾 usageCount+1
- **对话蒸馏**：/chat「💾 存为技能」→ POST `api/skills/distill`（读近 12 轮 → 一次 callAI + extractJson → 返回技能预览卡，可编辑名称/描述/关键词，步骤只读 → 确认保存跳技能架）
- **AI 主动提议**：`matchSkillSuggestion`（普通对话关键词命中触发关键词/技能名 → 回复下方「💡 你可能想用『…』→ 运行」芯片，一键运行、可关闭）
- **API**: `api/skills/route.ts`（GET 播种+列表 / POST 创建）、`api/skills/[id]/route.ts`（PATCH/DELETE）、`api/skills/distill/route.ts`（POST 蒸馏）

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
🤖 AI   → 💬对话 / 📊周报 / 🗺️路径 / ⚡技能
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
│   ├── ai-config.ts / ai-tools.ts     # callAI / AI 工具调用（10 个：含 propose_tasks 提案）
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
    └── api/                             # 52 个路由
```

## API 路由清单 (52 个)

| 分类 | 路由 |
|------|------|
| ai (9) | chat, generate-feedback, generate-plan, generate-questions, generate-similar, judge-plan, skills, skills/[id], skills/distill |
| admission (4) | search, analyze, saved, import |
| auth (1) | register（蜜罐+限流+邀请码，另有 `/auth/callback`、`/auth/signout` 为 app 路由） |
| admin (5) | feedback, feedback/[id], support, support/[id], users/reset-link |
| leaderboard (1) | route |
| user (5) | profile, avatar, export, reminders, settings |
| support/suggestions (2) | support, suggestions |
| chat/proposals (2) | confirm, reject（对话→任务提案：直连按钮绕过 AI 循环） |
| 核心业务 | chat, checkin, feedback, goal, tasks(+[id]), materials(+[id]), upload, practice(+[id]), wrong-questions(+[id],batch), questions/import, pomodoro/sessions+settings, knowledge-graph(+build,node/[id]), study-path(+progress), progress/summary |

## 数据库模型变更

| 模型 | 新增字段 / 说明 | 时间 |
|------|------|------|
| Task | `weekStartDate` + `source` + `@@index([userId, weekStartDate])` | 2026-07-28 |
| Goal | `progress` (Json) | 2026-07-28 |
| **Supporter** | 🆕 感谢墙留言：`userId?/name/amount/message/approved/createdAt`（审核制） | 2026-08-10 |
| **AuthorFeedback** | 🆕 意见反馈：`userId/rating/content/anonymous/status`（new→read→resolved） | 2026-08-10 |
| **Goal** | 🆕 `subjectsEdited Boolean @default(false)`（专业→科目联动：手动改过则不再自动覆盖） | 2026-08-13 |
| **User** | 🆕 `drivingMode String @default("assisted")`（驾驶模式三档：auto/assisted/manual） | 2026-08-13 |
| **Task** | 🆕 `proposalId String?` + `chatId String?` + `@@index([userId, proposalId])`；`source` 新增取值 `ai_confirmed` | 2026-08-13 |
| **Chat** | 🆕 `pendingProposal Json?`（待确认的任务提案草稿） | 2026-08-13 |
| **Skill** | 🆕 用户技能：`userId/name/description/icon/triggerKeywords/steps Json/note Json/usageCount/source/lastRunAt` + `@@unique([userId,name])` | 2026-08-13 |
| **Chat** | 🆕 `skillId String?` + `@@index([skillId])`（技能运行 = 带 skillId 的对话） | 2026-08-13 |

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

### 第 6 轮 — UI 一致性整改（2026-08-13，Batch 1A–4）
- **设计语言统一**：`bg-card`/`focus:ring-brand`/`text-muted-foreground` token 全库替换 + 布局错版修复（chat 高度/热力图偏移/周计划 chips 等）
- **基础组件抽取**：自建 `Toast`（替代 14 处 `alert()`）、`ConfirmDialog`（替代 5 处 `confirm()`）、`PageHeader`（14 页统一标题）、`Modal`（base-ui Dialog，9 处弹窗统一）
- **模块联动**：新建 `ModuleLinks` 组件替换 6 处"相关模块"补丁；study-path 里程碑→错题本科目筛选、checkin 成功态→排行榜、result-view→"已收录 X 道错题"
- **E2E 独立测试库**：`neondb_test`（自动建库 + pgvector + schema push + :3100 独立端口），91 用例隔离跑全绿，不再污染 dev 库
- **Batch 4 收尾**：容器宽度 2 档统一（checkin/admission 修正）+ 图标体系全 emoji（lucide-react 全库移除）+ 无障碍补齐（leaderboard aria-pressed、tasks 弹窗 label htmlFor）；webServer 超时 120s→240s
- 文档：`docs/UI_AUDIT.md` 全程留档

### 第 7 轮 — AI 共享 prompt 层 + 专业→科目联动（2026-08-13）
- **共享 prompt 层** `src/lib/ai-prompts.ts`：角色宪章（SYSTEM_CORE）+ 表达红绿线（EXPRESSION_GUARDRAILS）+ 开小差限制（SLACK_LIMITS）+ `buildChatSystemPrompt` 组合器，8 个 AI 路由收敛引用，杜绝各路由手写 prompt 造成语气割裂
- **专业→科目联动** `src/lib/major-subject-map.ts`：MAJOR_SUBJECT_MAP（统考预选 + 歧义专业 note）+ `normalizeMajor()`；Goal `subjectsEdited` 标记，已有 subjects 只补公共课不覆盖；subject-selector 加"检测到专业→应用推荐科目"条
- **承载位先行**：`ui-store` 加 `showAiThinking`（migrate 补齐）；tasks 页本地 getWeekStart 重复实现改用 `lib/date-utils`

### 第 8 轮 — 思考可见层 + 心路成长 UI 侧（2026-08-13）
- **思考可见（非流式第一层）**：`callAI` 已捕获的 `reasoningText` 在 5 个人类读入口透传（chat/generate-plan/judge-plan/generate-feedback/study-path，截断 ~1500）；新建 `src/components/ai-thinking.tsx` 折叠层，渲染到 /chat 与浮窗 assistant 消息上方；settings 界面定制加"显示 AI 思考过程"开关
- **心路成长 UI 侧**：checkin 三态 `STATUS_META` 常量 + 成功态安抚句；dashboard 温柔重入卡（今日未打卡 + 距上次>3 天 → "不用补，从今天的任务开始" + 番茄 10 分钟入口）；排行榜"本周 vs 上周"个人对比；新建 `src/lib/milestone.ts`（打卡天数/连续/错题/阶段完成）；周报 `Feedback.stats Json?` 存 prev/this 对比 + prompt 先写"vs 上周自己"

### 第 9 轮 — 驾驶模式三档（2026-08-13）
- `User.drivingMode`（auto/assisted/manual，默认 assisted=现状）；settings 界面定制三档选择器；`getUserAiConfig` 返回 drivingMode → chat 路由注入档位策略 prompt
- weekly-plan-reminder 自动档周日直接生成下周（写入仍保留 manual/ai_confirmed 不删）；辅助/手动保持询问
- **切档纪律**：settings 切档给"过渡摘要"（当前 AI 任务数 + 生成策略变化说明），永不静默接管

### 第 11 轮 — AI 技能系统（Round A + B：架页 + 运行引擎）（2026-08-13）
- **方向重定义**：从"官方技能=给工具加按钮"（被否）→ 用户自定义工作流层（用户自己组数据+提问+AI指令+档案+收尾的完整流程，产品覆盖通用、技能覆盖个性化）
- **schema**：`Skill` 模型（`@@unique([userId,name])`）+ `Chat.skillId` + `@@index([skillId])`
- **Round A 基建**：`src/lib/skill-templates.ts` 3 模板 + `src/lib/skills.ts` 播种/档案摘要；CRUD API（GET 惰性播种 / POST 重名 409 / PATCH / DELETE）；`/skills` 技能架页（卡片网格 + 编辑/删除弹窗 + 运行链接）；导航 AI 组加「⚡ 技能」+ ui-store migrate 补齐
- **Round B 运行引擎**：技能运行 = 带 skillId 的对话，复用 `/api/ai/chat` tool-calling 循环；`buildSkillRunPrompt` + `buildSkillDataSnapshot`（9 类数据源直查）+ 档案 note 摘要注入 system prompt；`skill_control` 工具（note_append/finish）仅技能运行注入（`getSkillRunTools` 与 `getToolDefinitions` 分离，普通对话不泄漏）
- **/chat 技能承载位**：`?skill=` 启动 kickoff（居中系统提示条）+ 斜杠菜单唤起 + 运行徽标「⚡ 技能：name」+ 结束技能按钮（路由直接收尾不走 AI）；历史技能对话恢复徽标
- 测试：skills.spec 7 用例（播种/CRUD/斜杠菜单/徽标恢复/无效 skill 回落），98 全绿

### 第 12 轮 — AI 技能系统 Round C（对话蒸馏 + AI 主动提议）（2026-08-13）
- **对话蒸馏**：`POST /api/skills/distill`（读 Chat 近 12 轮 → 蒸馏 prompt 带步骤 schema + 3 模板示例 → 一次 callAI + extractJson → 技能预览 `{name,description,triggerKeywords,steps}` 或 `invalid:true+reason`，不落库）
- **/chat「💾 存为技能」**：无 chatId 先 /api/chat 保存拿 id → 蒸馏 → 预览卡（名称/描述/关键词可编辑，步骤只读）→ 确认 POST /api/skills → 跳 /skills
- **AI 主动提议**：`matchSkillSuggestion`（拉用户技能，triggerKeywords + 技能名命中，技能运行/启动语不提议）→ chat 路由响应注入 `suggestedSkill` → 回复下方建议芯片（`skill-suggestion.tsx`，一键运行 + 可关闭）
- 测试：distill 400/404 + 建议芯片渲染/关闭，100 全绿

### 第 13 轮 — AI 等待安抚状态机（2026-08-14）
- **`src/hooks/use-ai-task.ts`**：前端时间驱动的等待状态机（非流式第一层）——**分阶段文案轮播**（0-2.5s 连接 / 2.5-8s 理解 / 8-16s 思考 / 16-30s 生成 / 30s+ 超时）+ **已等待时长/预估秒数**（越等越坦诚）+ **可取消**（AbortController，可逆性减半焦虑）
- **`src/components/ai-waiting.tsx`**：`bubble`（对话气泡）/ `inline`（按钮旁行内）两版渲染，统一「知道在等什么 + 知道要等多久 + 知道能随时离开」
- **对话面接入**：/chat 与浮窗的等待气泡从三色点换成 AiWaiting（分阶段 + 预估 + 取消）；`AbortError` 安静收场不追加错误消息；技能运行取消则放弃该次运行
- **页面级生成按钮接入**：周计划（生成/评审）、学习路径、学习周报、错题变式题的静态「生成中...」换成阶段文案 + 已等待秒数 + 取消
- 测试：`e2e/ai-waiting.spec.ts` 2 用例（拦截 `/api/ai/chat` / `generate-feedback` 延迟响应，断言阶段轮播 + 预估 + 取消），102 全绿

### 第 10 轮 — 对话→任务落地（事务边界）（2026-08-13）
- **schema**：Task `proposalId/chatId` + `@@index([userId, proposalId])`；Chat `pendingProposal Json?`
- **propose_tasks 工具**（writes:false 草稿不落库）：批量建议挂到对话 pendingProposal；`create_task` description 引导勿批量直写；chat 路由读 body.chatId → 提案时无对话则先建 → 返回 `chatId + proposal`
- **`src/lib/proposals.ts`**：`confirmProposal`（$transaction 批量 insert，`source:"ai_confirmed"` + 逐条 `getWeekStart` + proposalId/chatId）、`revokeProposal`（清空草稿）
- **API** `POST /api/chat/proposals/confirm|reject`：直连按钮绕过 AI 循环；**/chat 提案卡**（清单 + 逐项勾选 + 采纳/拒绝，采纳后从消息移除并重存）；浮窗保持事务直写 + `floating` prompt 引导批量需求去 /chat
- **修复隐患**：generate-plan 增量删除改为 `source notIn [manual, ai_confirmed]`（不再误删已确认提案）；PATCH `/api/tasks/[id]` 支持改 `subject`

## 待优化

| 优先级 | 任务 |
|--------|------|
| P1 | 院校情报 (`/admission`) 前端启用（**用户已决定保持隐藏**；SerpAPI 付费 + 反爬风险。前端已整改完，启用只需 ui-store `visible:false`→true） |
| P1 | 数据库迁移到生产环境（当前 Neon 免费档） |
| P2 | PWA 离线策略优化（导航网络优先，仅 offline.html 兜底，未缓存 API 数据） |
| P3 | SWR 缓存（显式降级 backlog：不引入第三种数据获取模式；统一方向为 React Query + `useApi` hook，见 UI_AUDIT §五-H） |
| P3 | 学习圈：点赞/互关/动态等更深社交（当前仅排行榜） |
| P3 | **AI 技能系统 V1 已完整落地**（架页 + 运行引擎 + 蒸馏 + 提议）。后续：可视化工坊（拖拽编排 steps）、定时触发、技能分享/社区 |
| P3 | **AI 等待安抚状态机已落地**（useAiTask 分阶段 + 预估 + 可取消）。后续：流式思考（第二层，先用展开率数据决策是否值得投）；/chat 蒸馏加载也可换用等待气泡 |

## 部署记录

| 日期 | 范围 | 内容 |
|------|------|------|
| 2026-08-14 | `a3c759c..68e6ae9` → 生产 | **AI 等待安抚状态机**（useAiTask 分阶段文案轮播 + 预估秒数 + 可取消，全量接入对话/浮窗/周计划/学习路径/周报/变式题），102 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `310249a..d61c208` → 生产 | 错题本按钮按触发问题智能显示 + **AI 技能系统全三阶段**（架页/模板播种 + 运行引擎 + 蒸馏/AI 提议），100 用例全绿；`c6-orcin.vercel.app` |

> 更早部署（错题本/学习圈/个人资料/落地页/认证等）记录在各轮迭代标题的「已部署」标记中。

## 最近提交 (最新→最旧)

```
4d2e20f feat: 等待安抚状态机 — useAiTask 分阶段等待(文案轮播+预估秒数+可取消) + AiWaiting 组件
d61c208 docs: 项目状态补 Round C — 蒸馏 + 提议 + 100 用例
a0d8029 feat: AI 技能系统 Round C — 对话蒸馏 + AI 主动提议
4f42485 docs: 更新项目状态日志至 2026-08-13 — AI 技能系统 Round A+B（架页+运行引擎）
41e0d17 feat: AI 技能系统 — 技能架页 + 模板播种 + 技能运行引擎
310249a fix: 错题本按钮按触发问题智能显示 — 复习计划等非题解回答不再附带
3294139 feat: AI 层 4 轮 — prompt 共享 / 思考可见 / 驾驶模式 / 任务提案事务边界
7ce2b86 refactor: UI 审计 Batch 4 — 容器宽度 2 档统一 + 图标全 emoji(lucide 移除) + 无障碍补齐
56bbd89 feat: UI 一致性整改第 6 轮 — 基础组件 + 模块联动 + E2E 独立测试库 (Batch 1A-3)
e597021 docs: 更新项目状态日志至 2026-08-10 — 19 模块 / 47 API / 5 轮迭代记录
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

- Playwright 102 用例全绿（authenticated + unauthenticated 双项目，per-project testMatch）
- 覆盖：全部模块页面 + 认证重定向 + PWA 资源 + 权限（admin/suggestions/profile 403/重定向）+ 导出下载 + 头像上传 + 排行榜点击进公开页 + 技能系统（9）+ 等待安抚气泡（2，路由拦截模拟慢 AI）
- 注意：`e2e/.auth/user.json` 为测试账号存储态；E2E 运行在独立测试库 `neondb_test`（`playwright.config.ts` 自动建库 + schema push + 独立端口 3100），不再污染 dev 库
