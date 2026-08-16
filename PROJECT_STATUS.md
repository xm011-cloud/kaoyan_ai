# AI 考研助手 — 项目状态

> 最后更新: 2026-08-16 | 分支: `dev` | 维护者: Xm

## 项目概述

面向考研学生的 AI 全栈备考平台。覆盖从目标设定、计划生成、每日学习、刷题练习、错题管理、知识图谱、院校情报，到排行榜（打卡时长排名）、个人资料、数据导出与作者激励的完整考研备考链路。开放注册（蜜罐 + 限流防滥用），单作者业余开发，所有功能免费。

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
| 测试 | Playwright 122 用例 · 独立测试库 `neondb_test` | ^1.61.1 |
| 部署 | Vercel (c6-orcin.vercel.app) | — |

## 模块清单 (19 个)

### 📅 今日组

#### 🏠 概览 (`/dashboard`)
- 统计卡片、热力图、趋势图、今日任务；查询 Set/Map 单遍历派生（6→2 查询），图表限 90 天

#### ✅ 打卡 (`/checkin`)
- 每日学习时长 + 心情 + 备注（排行榜/资料页数据源）

#### 🍅 番茄钟 (`/pomodoro`)
- 25+5 番茄工作法，SVG 环形计时器，反漂移引擎，通知+音频，后台自动保存，ActivityBar 交互控制

#### 🏆 排行榜 (`/leaderboard`) — 🆕 2026-08-10
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

#### 🏫 院校情报 (`/admission`) — 🆕 社区知识库 2026-08-14
- 搜索 / 对比 / 收藏 / 导入 4 Tab；**社区知识库型**：搜索先查库（无需 AI Key）→ 未命中才百度搜索 + AI 提取 → 成功自动落库全局共享（userId=null，标注来源 + unverified）
- **多来源并存**（同校同专业同年允许多条，信任度排序展示）+ 状态徽标（✅已验证 / ⚪未验证 / ⚠️待核实 / ✗存疑）
- **社区反馈**：👍 认同 / ⚠️ 质疑（一人一条可改投，质疑需原因）→ 质疑进作者后台审核（确认错误→存疑 / 驳回）
- 空结果不落库；未配 AI 时查库可用、未命中给配置引导；生产限流 5/min/IP

### ⚙️ 设置组

#### 👤 个人资料 (`/profile`) — 🆕 2026-08-10
- 昵称编辑 + 头像上传（public `avatars` 桶，≤2MB，JPG/PNG/WebP/GIF）
- **公开资料页** `/user/[id]`：查看他人昵称/头像/打卡统计（累计/本周/连续），**不暴露 email**
- **API**: `api/user/profile/route.ts`（GET 自己/公开视图 + PUT 昵称）、`api/user/avatar/route.ts`（上传 + best-effort 清理旧图）

#### ⚙️ 设置 (`/settings`)
- AI Key/URL/Model 配置（**用户自带 Key 模式**，含配置状态卡 + 测试连接 + 服务指引），学习提醒，界面定制（导航分组/工作台卡片/出题偏好），数据导出

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
📅 今日 → 🏠概览 / ✅打卡 / 🍅番茄钟 / 🏆排行榜
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
| **AdmissionSearchCache** | 🆕 院校搜索全局缓存：`queryKey @unique` + `payload Json` + `updatedAt`（24h TTL，相同查询所有人共享） | 2026-08-14 |
| **AdmissionInfo** | 🔄 去 `@@unique([university,major,year,category])`（**允许多来源并存**）；`verified Boolean` → `verifyStatus String`（unverified/verified/disputed/rejected） | 2026-08-14 |
| **AdmissionFeedback** | 🆕 社区反馈（认同 👍/质疑 ⚠️）：`admissionInfoId + userId @@unique`（一人一条可改投）+ `reason`（质疑必填）+ `status`（pending/accepted/rejected） | 2026-08-14 |

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

### 第 14 轮 — 院校情报启用 + 加固（2026-08-14，已部署）
- **启用**：ui-store v3→v4，`/admission` 默认可见 + migrate 强制老用户导航显示（仅迁移生效一次，之后仍可自行隐藏）
- **搜索缓存**：新增 `AdmissionSearchCache`（全局共享 `queryKey=university|major|year`、24h TTL、payload 快照）；命中 = 免百度爬取 + 免 AI 提取，秒回 +「⚡ 命中缓存：抓取于 X 小时前」；写失败 best-effort 不影响返回
- **限流**：search route 复用 `rate-limit.ts`，生产 5/min/IP（缓存命中免费，未命中烧 AI + 爬取需防滥用）
- **反馈闭环**：结果页「🙏 数据有误？反馈给作者」→ `/suggestions?content=` 预填上下文（suggestions-client 新增 URL 预填）
- 测试：admission 新增导航可见 + 缓存命中 2 用例（真实搜索 1.4m 慢但稳），104 全绿

### 第 15 轮 — AI 用户自带 Key 模式（2026-08-14，已部署）
- **模式切换**：移除生产 Vercel env 的 `OPENAI_API_KEY`（代码保留全局兜底逻辑供本地 dev/E2E 用）；生产 AI 由用户自配 OpenAI 兼容 Key（MiMo/DeepSeek/通义千问等），`getUserAiConfig` 无 key 返回 null
- **配置状态卡**：settings「AI 配置」Tab 顶部状态卡（⚪ 未启用 / 🟢 已配置 + key 掩码 + 系统默认态），GET settings 新增 `aiConfigured` 派生字段
- **测试连接**：`POST /api/user/settings/test-ai`（最小 chat 调用，分类错误：Key 无效/模型不存在/额度不足/网络）；保存后可一键验证 + 延迟展示
- **服务指引**：settings 内嵌 MiMo/DeepSeek/通义千问 Key 获取说明（URL + 模型名 + Base URL）
- **chat / 浮窗引导**：未配置时前置引导条（`AiConfigBanner`：AI 未启用 + 去配置）+ 输入禁用；后端 `needConfig` 响应 → `markUnconfigured` 联动显示引导条（普通发送 + 技能运行两路）；新建 `useAiConfigStatus` hook（默认 configured=true 防首帧闪烁）
- **公开文案**：落地页/about 同步「产品免费，AI 功能需自备 API Key 计费」
- 测试：`e2e/ai-config.spec.ts` 4 用例（未配置状态卡/测试连接成功/chat 引导条禁用/needConfig 联动，全部 route mock 稳定可复现），108 全绿

### 第 16 轮 — AI 产品教练 + 更新日志（2026-08-14，已部署）
- **AI 产品教练**：新增 `src/lib/product-guide.ts`（19 模块真实功能知识：用途/入口/使用要点）注入 `buildChatSystemPrompt`，配置好 AI 的用户在任何对话问"XX 怎么用"都能得到准确回答；技能系统新增第 4 个内置模板「产品教练 🧭」（问功能 → AI 按指引讲解 → 记入档案）
- **模板补播**：`ensureTemplatesSeeded` 从"count>0 不播"改为**按模板名补缺**，老用户自动获得新增模板
- **更新日志**：`/changelog` 页（静态数据源 `src/lib/changelog.ts`，用户向文案 7 条）；导航设置组新增「📣 更新日志」
- **更新告示**：dashboard 顶部 `ChangelogBanner`（client 组件嵌入 server 页），ui-store v4→v5 加 `lastSeenChangelog`，只在有新版本时出现、可关闭、已读持久化
- 测试：`e2e/changelog.spec.ts` 5 用例（页渲染/导航入口/告示显示与关闭/已读持久化/产品教练模板补播），113 全绿

### 第 17 轮 — 院校情报社区知识库 + 信任机制（2026-08-14，已部署）
- **知识库型重构**：搜索路由改为**库优先**（`AdmissionInfo` userId=null 全局行，无需 AI Key 秒回）→ 未命中才百度搜索 + AI 提取 → 成功**自动落库全局共享**（标注来源 + unverified）→ 空结果不落库；未配 AI 时查库可用、未命中给配置引导；**移除 AdmissionSearchCache 缓存逻辑**（落库替代缓存）
- **多来源并存**：去 `@@unique([university,major,year,category])`，同校同专业同年允许多条（各自来源），前端按信任度排序展示 + 状态徽标（✅已验证 / ⚪未验证 / ⚠️待核实 / ✗存疑）
- **社区信任机制**：`AdmissionFeedback` 表（👍 vouch / ⚠️ dispute，一人一条可改投，质疑必填原因）；质疑 → 数据标 `disputed` → **admin 新增「院校质疑」Tab**（确认错误→`rejected` / 驳回→回 unverified）
- **前端**：结果区改造（库命中横幅 + 重新搜索最新 + 新入库提示 + needAI 引导 + 反馈按钮计数）；「数据有误？反馈」直通建议页保留
- 测试：admission 缓存用例 → **共享库 + 反馈用例**（直插测试库全局数据验证查库/认同/质疑全链路，E2E 网络受限不依赖真实爬取），113 全绿

### 第 18 轮 — 院校数据获取三路线（2026-08-14，已部署）
- **数据源实测结论**：百度/必应中国/搜狗/研招网对非浏览器请求全部反爬或相关性灾难（实测：必应"复旦计算机分数线"返回魔兽攻略）→ **服务端免费爬虫路线确认不可行**
- **searchWeb 重构**：新增 **Tavily API 优先**（`TAVILY_API_KEY`，免费 1000 次/月，中文效果好）；必应/百度/DuckDuckGo 降为免费兜底；新增**核心词相关性评分排序**（`mustInclude`：标题/URL 命中核心词越多越靠前，相关结果排前供 AI 提取）
- **AI 联网调研工具**：`ai-tools` 新增 `search_web` 工具（对话里用户问院校分数线/科目等 → AI 自行联网搜索带来源回答，对应开源社区 kaoyan-navigator 形态）
- **数据积累策略**：放弃人工种子数据（核对成本高），**库数据由每次搜索自动落库积累** —— Tavily 搜索 → AI 提取 → 落库全局共享，越搜越全（对应第 17 轮机制）

### 第 19 轮 — 真题链路打通（2026-08-14，已部署）
- **断头路修复**：`ImportedQuestion` 从"只有写入 + 导出"变为完整消费链路（导入 → 管理 → 练习）
- **真题练习模式**：`practice-generator` 新增 `exam_questions` 模式（**直接从真题库抽题，无需 AI**，Fisher-Yates 洗牌）；practice route 支持 + 空真题友好提示 404；练习页新增「📚 真题练习」模式（session-creator + ui-store PracticeMode 扩展）
- **真题管理**：错题本新增「📚 真题」Tab（`ExamQuestionsTab`：联网导入入口（科目/年份/关键词）+ 科目计数筛选 + 列表/来源/删除/去练习）；新 API `GET/DELETE /api/questions`
- **修复**：真题 Tab 按钮被错误包进 filters 条件（exam 模式下无法切回其他 Tab）—— Tab 按钮区独立始终显示
- 测试：`e2e/exam-questions.spec.ts` 1 用例（直插真题 → Tab 展示 + 练习 API 抽题 + 空科目 404），114 全绿

### 第 20 轮 — 合规与作品面（2026-08-14，已部署）
- **隐私政策页 `/privacy`**：数据收集清单 + **数据出境告知**（当前部署于海外服务商 + "条件成熟将评估迁回国内、数据随迁"）+ 用户权利（导出/注销/更正）+ 第三方服务说明 + 未成年人保护
- **用户协议页 `/terms`**：AI 自带 Key 模式说明 + 内容不保证准确 + **版权声明**（真题个人学习用途不共享、院校数据标来源、Apache-2.0 开源）+ 用户行为规范 + 免责声明
- **注册勾选**：注册表单加"同意《用户协议》与《隐私政策》"勾选（未勾选不能注册）；落地页/about footer 加隐私/协议链接；设置页加隐私入口
- **请求注销**：`DeletionRequest` 模型（userId unique + email 快照 + pending/done）+ `POST/GET/DELETE /api/user/deletion-request`（幂等/可取消）+ 设置页"请求注销账号"（确认弹窗 + 状态 + 取消）+ admin「🗑️ 注销请求」Tab（处理步骤指引 + 标记完成）
- **README 展示版**：在线体验 + 19 模块亮点 + 技术栈 + 架构 + 114 用例 + 合规链接 + 开源说明（开发文档折叠保留）；**LICENSE**（Apache-2.0）
- 测试：`e2e/compliance.spec.ts` 3 用例（隐私/协议页渲染 + 设置页注销入口），117 全绿

### 第 21 轮 — 开放注册（2026-08-14，已部署）
- **移除邀请码门槛**：register API 删除邀请码校验（保留蜜罐 + 限流 5/min/IP + 邮箱/密码格式校验）；登录页移除邀请码输入框；`REGISTER_INVITE_CODE` env 不再使用
- **文案同步**：README/PROJECT_STATUS 概述"封闭邀请制" → "开放注册"；changelog 新增「开放注册」条目（dashboard 告示会提示）
- **安全评估**：开放注册垃圾成本低（数据量小 + AI 成本用户自理 BYOK），蜜罐 + 限流已挡机器人灌号
- 测试：全量 117 用例（login 相关用例兼容无邀请码表单）

### 第 22 轮 — 新用户引导（2026-08-14，已部署）
- **首次引导弹窗 `OnboardingModal`**：新用户首次进 dashboard 弹出 —— 4 分组 19 功能导览 + **AI 使用说明（重点）**（自带 Key、设置路径、不配置不影响非 AI 功能）；「去配置 AI / 先逛逛」两按钮，关闭后不再弹（ui-store `onboardingSeen`，v5→v6）
- **常驻引导卡 `OnboardingCard`**：dashboard 顶部 3 步清单 —— ① 配置 AI Key（状态同步 aiConfigured）② 设置考研目标（hasGoal 勾选）③ 探索功能（打卡/错题/院校/技能直达链接）；全部完成自动收起，可手动关闭
- **新用户判定**：server 端 `!goal && 无任务 && 无打卡`；老用户（有学习数据）完全不显示
- **目标后置**（按用户要求）：功能导览 + AI 使用优先，设目标放在引导卡第 2 步
- 测试：`e2e/onboarding.spec.ts` 1 用例（开放注册真实新账号 → 登录 → 弹窗出现 → 关闭 → 引导卡 3 步可见），118 全绿

### 第 23 轮 — 等待安抚扩展到重操作 + 导航文案统一（2026-08-16）
- **等待安抚扩展**：`useAiTask` + `AiWaiting` 接入 3 处重操作 —— ① **院校搜索**（可取消，AbortController 静默收场）② **真题联网导入**（可取消）③ **练习 AI 出题**（inline 仅安抚，mutation 不可中断）
- **导航/文案统一**：学习圈→排行榜、资料→学习资料、院校→院校情报、偏好→设置、真题→真题库、profile shortLabel→主页（`nav.ts` + PageHeader + PROJECT_STATUS + spec 断言同步）
- **E2E 基建**：`global-setup` 预置 `weeklyPlanPrompted` 防打扰 key —— 修复**周日跑 E2E** 时「本周告一段落」周计划提醒弹窗（aria-modal）遮挡页面导致 skills 用例失败的 flake；`e2e/_testdb.txt`（含 Neon 数据库凭据）加入 `.gitignore`
- 测试：121 用例全绿（新增 admission 搜索可取消 / 真题导入可取消 / 练习出题仅安抚 3 用例，均路由拦截模拟慢 AI）

### 第 24 轮 — 移动端体验 + 离线能力 + PWA 上传修复（2026-08-16）
- **移动端布局 P0-P2 全改**（iPhone 视口审计驱动）：① **P0 表单字号** —— 移动端 `input/textarea/select` 强制 16px（消灭 iOS Safari 聚焦自动缩放）；② **P1 触控目标** —— 科目选择器 chips/输入框、练习模式按钮、浮窗头部按钮、dashboard 卡片"查看全部"链接、更新告示/新手指引关闭按钮等全部 ≥44px（`min-h-11` + 负 margin 保证视觉不撑高）；③ **P2 弹窗/键盘** —— Modal 移动端底部抽屉化（`sm:` 桌面居中还原）+ 布局 `viewport-fit=cover` + safe-area 内边距 + chat 输入框 visualViewport resize 自动滚回视野
- **离线读**：Service Worker v3 —— 导航网络优先 + 静态缓存优先 + **GET `/api/*` 网络优先缓存兜底**；登出清空 API 缓存
- **离线写队列**：IndexedDB 写入队列（`src/lib/offline-queue.ts`）—— 打卡离线乐观成功 + 入队、任务完成切换离线入队（dedupeKey 合并）；联网自动补传（`useOfflineSync`）；离线横幅显示待同步数
- **PWA 上传修复**（用户反馈：封装 PWA 不能上传资料）：资料上传/真题导入的隐藏 file input 从 `display:none` + 程序化 `.click()` 改为 `<label>` 原生激活 —— 修复 iOS standalone 下浏览器拦截程序化 click
- 测试：122 用例全绿（新增 `offline.spec.ts` 离线横幅 + 打卡入队 + 联网补传 1 用例；materials 上传定位改 label）

### 第 10 轮 — 对话→任务落地（事务边界）（2026-08-13）
- **schema**：Task `proposalId/chatId` + `@@index([userId, proposalId])`；Chat `pendingProposal Json?`
- **propose_tasks 工具**（writes:false 草稿不落库）：批量建议挂到对话 pendingProposal；`create_task` description 引导勿批量直写；chat 路由读 body.chatId → 提案时无对话则先建 → 返回 `chatId + proposal`
- **`src/lib/proposals.ts`**：`confirmProposal`（$transaction 批量 insert，`source:"ai_confirmed"` + 逐条 `getWeekStart` + proposalId/chatId）、`revokeProposal`（清空草稿）
- **API** `POST /api/chat/proposals/confirm|reject`：直连按钮绕过 AI 循环；**/chat 提案卡**（清单 + 逐项勾选 + 采纳/拒绝，采纳后从消息移除并重存）；浮窗保持事务直写 + `floating` prompt 引导批量需求去 /chat
- **修复隐患**：generate-plan 增量删除改为 `source notIn [manual, ai_confirmed]`（不再误删已确认提案）；PATCH `/api/tasks/[id]` 支持改 `subject`

## 待优化

| 优先级 | 任务 |
|--------|------|
| P1 | **国内访问入口**（推广前置条件）：`*.vercel.app` 国内不稳定。EdgeOne Pages 已尝试但 **Cloud SSR 函数包 128MiB 超限**（全栈 Next.js + Prisma + mermaid 太重，externalNodeModules 未生效）；备选：**腾讯云轻量服务器 Docker**（无包限制，~¥60/月，需备案绑域名，IP 直访可先用）。**已决定暂缓**（不投入），推广先面向技术圈/海外可达用户 |
| P1 | 数据库迁移到生产环境（当前 Neon 免费档；**已决定暂缓** —— 先定时 warm-up 缓解冷启动，等部署地域决策确定后与部署一起迁） |
| P2 | PWA 离线读+写队列已落地（2026-08-16：静态/GET API 缓存兜底 + IndexedDB 写入队列自动补传）。后续：离线包预缓存 / 会话与草稿落盘 |
| P3 | SWR 缓存（显式降级 backlog：不引入第三种数据获取模式；统一方向为 React Query + `useApi` hook） |
| P3 | 排行榜/学习圈：点赞/互关/动态等更深社交（当前仅排名） |
| P3 | **AI 技能系统 V1 已完整落地**。后续：可视化工坊（拖拽编排 steps）、定时触发、技能分享/社区 |
| P3 | **AI 等待安抚状态机已落地**（对话/浮窗/周计划/路径/周报/变式题 + 院校搜索/真题导入/出题）。后续：流式思考（第二层，先用展开率数据决策是否值得投）；/chat 蒸馏加载也可换用等待气泡 |

## 部署记录

| 日期 | 范围 | 内容 |
|------|------|------|
| 2026-08-16 | `4c5029c..4dc95f9` → 生产 | **等待安抚扩展 + 导航文案统一**（院校搜索/真题导入可取消 + 练习出题仅安抚；学习圈→排行榜等词统一；global-setup 修周日 E2E 弹窗 flake），121 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `09d41e9..4c5029c` → 生产 | **新用户引导**（首次弹窗：功能导览 + AI 使用说明；常驻引导卡：AI 配置/设目标/探索功能），118 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `95c81ee..cdb5e92` → 生产 | **开放注册**（移除邀请码门槛，保留蜜罐+限流；文案同步 + changelog 新条目），117 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `0a06573..d672307` → 生产 | **合规与作品面**（隐私政策/用户协议页 + 注册勾选 + 请求注销 + admin 注销 Tab + README 展示版 + Apache-2.0 LICENSE，schema：DeletionRequest），117 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `7770317..cafa83c` → 生产 | **真题链路打通**（真题练习模式直接抽题 + 错题本真题 Tab 导入/管理 + `/api/questions`），114 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `cf3108d..21702c9` → 生产 | **院校数据获取三路线**（Tavily API 接入 `TAVILY_API_KEY` + 核心词相关性排序 + AI `search_web` 工具 + 种子数据初稿 `docs/seed-data-draft.json`），113 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `e756fb0..a51c6a8` → 生产 | **院校情报社区知识库**（搜索落库全局共享 + 多来源并存 + 认同/质疑信任机制 + admin 审核，schema：AdmissionInfo 去唯一键 + AdmissionFeedback 表），113 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `b689d66..71ac7c5` → 生产 | **AI 产品教练 + 更新日志**（PRODUCT_GUIDE 注入对话 + 产品教练技能模板 + `/changelog` 页 + dashboard 更新告示），113 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `df6114a..b689d66` → 生产 | **AI 用户自带 Key 模式**（移除生产 `OPENAI_API_KEY`，AI 由用户自配；配置状态卡 + 测试连接 + chat/浮窗未配置引导），108 用例全绿；`c6-orcin.vercel.app` |
| 2026-08-14 | `df55d06..007adc4` → 生产 | **院校情报启用 + 加固**（24h 全局搜索缓存 + 生产限流 + 数据反馈入口），104 用例全绿；`c6-orcin.vercel.app` |
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

- Playwright 122 用例全绿（authenticated + unauthenticated 双项目，per-project testMatch）
- 覆盖：全部模块页面 + 认证重定向 + PWA 资源 + 权限（admin/suggestions/profile 403/重定向）+ 导出下载 + 头像上传 + 排行榜点击进公开页 + 技能系统（9）+ 等待安抚（5，路由拦截模拟慢 AI：chat 气泡/周报行内 + 新增院校搜索可取消/真题导入可取消/练习出题仅安抚）+ 院校导航可见 + 搜索缓存命中（2，真实搜索验证 24h TTL）+ AI 配置引导（4，状态卡/测试连接/chat 引导条/needConfig 联动，route mock）+ 更新日志与告示（5，页渲染/导航入口/告示显示关闭/已读持久化/产品教练补播）+ 离线能力（1，离线横幅/打卡入队/联网补传）
- 基建：global-setup 预置 `weeklyPlanPrompted` 防打扰 key（周日不弹周计划提醒，修复 E2E 周日 flake）
- 注意：`e2e/.auth/user.json` 为测试账号存储态；E2E 运行在独立测试库 `neondb_test`（`playwright.config.ts` 自动建库 + schema push + 独立端口 3100），不再污染 dev 库
