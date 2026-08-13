# UI 整改审计报告 — 割裂感 / 错版重叠 / 拼合痕迹

> 通读全部页面与组件源码后,按"文件:行号"逐条列出可执行整改项。核验日期:2026-08-13。
> 结论先行:所有问题都源于**三套历史迭代留下的两种设计语言并存 + 逐个页面手写布局、没有共享基础组件**,以及**若干硬编码高度/宽度没有适配 OS 外壳**。

## 整改进度

| 批次 | 内容 | 状态 |
|------|------|------|
| 1A | 布局错版修复(chat 高度、heatmap 偏移、周计划 chips、tasks 进度行等) | ✅ 完成 |
| 1B | 设计 token 统一(`bg-card`/`focus:ring-brand`/`text-muted-foreground` 全库替换) | ✅ 完成 |
| 2A | 自建 Toast(zustand)替换全部 `alert()` | ✅ 完成 |
| 2B | ConfirmDialog 替换全部 `confirm()` | ✅ 完成 |
| 2C | PageHeader 组件抽取,14 个页面标题区统一 | ✅ 完成 |
| 2D | 统一 Modal(base-ui Dialog)替换 9 处手写弹窗 | ✅ 完成 |
| 2E | a11y 补全(aria-label / 语义化测试选择器) | ✅ 完成 |
| 2F | 门禁验证:`tsc` 0 错 + `build` 通过 + Playwright 91/91 | ✅ 完成 (2026-08-13) |
| 3 | 模块联动 CTA 替换"相关模块"补丁 + 架构决策 | ✅ 完成 (2026-08-13) |
| 4 | 收尾:容器宽度 2 档 / 图标全 emoji / 无障碍补齐 | ✅ 完成 (2026-08-13) |

### Batch 3 完成说明

**模块联动 CTA(3A)**
- 新建 `src/components/ui/module-links.tsx`("继续学习"卡片),统一 6 处手贴的"相关模块"pill 样式(原样式每页各写各的)
- 替换页:tasks / study-path / wrong-questions / feedback / checkin / practice result-view
- 上下文链接新增:
  - study-path 里程碑行 → `📕 {科目}错题`(带 `?subject=` 筛选跳错题本)
  - checkin 成功态 → `🏆 看看这周排名`(/leaderboard)
  - practice result-view → `📕 已收录 X 道错题到错题本 → 去复习`(practice 页新增 `addedWrongIds` Set 追踪计数)
  - goal 保存成功 CTA 文案 → `🚀 去生成周计划`
- E2E 定位器同步:`text=相关模块` → `getByText("继续学习")`

**架构决策(3B)**
- **admission:保持隐藏**(用户决定)。PROJECT_STATUS 已记录原因(SerpAPI 付费 + 反爬风险),前端已整改为新设计,后续启用只需 `ui-store.ts` 的 `visible:false → true`
- **E2E 独立测试库**(用户决定,已实现):
  - `e2e/create-test-db.mjs`:幂等创建 `neondb_test` + 启用 pgvector
  - `playwright.config.ts`:从 dev `DATABASE_URL` 派生 `_test` URL,webServer 命令链 `建库 → prisma db push(--accept-data-loss) → dev -p 3100`,env 覆盖 `DATABASE_URL`
  - 独立端口 3100 + `reuseExistingServer: false`,与开发中的 :3000 dev server 隔离
  - `global-setup.ts`:登录后 ping `/api/goal` 触发 `ensureLocalUser`,在空测试库写入 User 行
  - 已验证:全套 91 用例在隔离库全绿

**SWR 缓存(3C)**:显式移入 backlog。不引入第三种数据获取模式(当前为 React Query + 原生 fetch),统一方向仍见下方 §五-H。

### Batch 4 完成说明

**4A login/loading/error**:经核查三文件在 1B/2 批已全部换新设计语言,无残留改动。
**4B header 溢出**:经核查已整改(tab `overflow-x-auto [scrollbar-width:none]`、日期 `hidden xl:block shrink-0`、滑出菜单 `overflow-y-auto`),无残留改动。
**4C 容器宽度 2 档统一**:认证页已基本收敛为 `max-w-3xl`(内容页)/ `max-w-6xl`(dashboard、tasks 大页)。仅 2 处越档修正:
- `checkin/page.tsx` `max-w-2xl` → `max-w-3xl`(×2,成功态与表单)
- `admission/page.tsx` `max-w-4xl` → `max-w-3xl`(隐藏页,与其余内容页对齐)
**4D 图标体系全 emoji**:lucide-react 全库移除(最后两处:番茄钟)。
- `pomodoro-timer.tsx`:`⚙️`(设置)/`🔄`(重置)/`▶`(开始/继续)/`⏸`(暂停)/`⏭`(跳过),与 ActivityBar/mobile-nav 既有的 `▶`/`⏸` 字符一致;emoji 加 `aria-hidden`(按钮已有 aria-label/文字)
- `pomodoro-settings.tsx`:关闭按钮 `X` 图标 → `✕`(与 Modal 等全站关闭按钮一致)
**4E 无障碍补齐**:
- leaderboard 周期切换按钮加 `aria-pressed={period === t.id}`
- tasks 编辑任务弹窗 5 个 `<label>` 补 `htmlFor` + input `id`(标题/描述/时长/日期/科目)
- weekly-planner 的 ↻ 按钮在重构时已带 `aria-label`,无需再改
**门禁**:`tsc` 0 错 + `build` 通过 + Playwright 91/91 全绿。
**顺带修复**:webServer 超时 120s → 240s(建库 + schema push 约 30s + Turbopack 首编译,冷环境超时)。

---

## 一、文字错版 / 重叠 / 溢出(最优先,直接影响观感)

### 1. 对话页整页高度硬编码,移动端输入框会被底部导航挡住
- **`src/app/(authenticated)/chat/page.tsx:273`**
  ```tsx
  <div className="flex flex-1 flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
  ```
- **问题**:外壳是 `Shell`(`src/components/shell.tsx`)的 `h-dvh flex flex-col` = Header(h-12) + main(flex-1) + MobileNav(h-14,移动端) / ActivityBar(桌面)。chat 页面自己又算一遍 `100vh`,没有减去移动端底部导航(56px)和 iOS 地址栏 → **底部输入框会被 MobileNav 盖住**,且桌面端 `lg:h-screen` 比容器(main 的高度 = 100dvh − 48px)高出 48px → **双滚动条**。
- **修法**:删掉高度自算,让父容器接管。`<div className="flex flex-1 flex-col min-h-0">`,消息列表 `flex-1 overflow-y-auto min-h-0`,输入区 `shrink-0`。

### 2. 周计划 7 列网格里任务卡内容放不下
- **`src/app/(authenticated)/tasks/_components/weekly-planner.tsx:173`** — `grid grid-cols-1 md:grid-cols-7 gap-3`
- **`weekly-planner.tsx:199-213`** — 任务卡内:标题 + 底下一行 `flex gap-2`(科目 chip + `xxmin` + `✍️`)
- **问题**:md 断点(768px)直接 1→7 列,每列 ≈ 100px,卡片内宽约 80px。科目 chip(`text-[10px] bg-blue-100`)+ 时长 + ✍️ 一行放不下 → **chip 溢出 / 文字压边**;`text-xs` 任务标题两字就折行。
- **修法**:列内放不下就在窄列下 `flex-wrap` 让 chip 换行;或 md 用 `grid-cols-2/3/5` 阶梯,`xl:grid-cols-7` 才满铺;chip 加 `truncate max-w-full`。

### 3. 热力图月份标签对不齐 + 隐藏标签占位
- **`src/components/heatmap.tsx:102`** — `CELL = "w-3.5 h-3.5"`(14px)
- **`heatmap.tsx:141-143`** — 列容器 `flex gap-[3px]` → **实际列距 = 14 + 3 = 17px**
- **`heatmap.tsx:114-127`** — 月份标签 `marginLeft: ml.col * 16`(按 16px 算)→ **每列向左偏 1px,月份累计偏移**,月份标注与色块对不上。
- **`heatmap.tsx:121`** — `visibility: "hidden"` 的标签仍占位 → 标签行被撑宽,窄屏横向滚动时月份行与网格行宽度不一致。
- **修法**:统一常量 `PITCH = 17`;隐藏月份改用 `hidden` 或者渲染时直接跳过(不渲染该 span)。

### 4. 计划页"各科进度"行在窄屏挤爆
- **`src/app/(authenticated)/tasks/page.tsx:377-391`**
  ```tsx
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium">{subj}</span>
    <div className="flex items-center gap-3">
      ...三个统计 chip(🧠x% 🔴a/b 📝y%)...
      <input type="number" ... className="w-14 ..." />
      <span className="text-xs text-gray-400 w-6">%</span>
    </div>
  </div>
  ```
- **问题**:科目名 + 3 个 chip + 数字输入框 + `%` 在同一行 `justify-between`,**没有换行**,375px 手机 ≈ 480px 的内容 → 统计区溢到科目名上、或整行超出屏幕。
- **修法**:统计 chip 改 `flex-wrap`;或拆两行(科目名 + 百分比一行,chips 一行);输入框 `w-14` 改 `w-16 min-w-0`。

### 5. 练习历史行右侧三个元素无 wrap
- **`src/app/(authenticated)/practice/page.tsx:402-427`**
- **问题**:行右侧 `flex items-center gap-3` 内同时放"分数 12/20 + 状态 ✅已完成 + 日期",左侧还有科目名(`:407`)。窄屏三者挤在一起、日期被截。
- **修法**:日期或状态移到下一行;右组加 `shrink-0` 但左标题 `min-w-0 truncate`。

### 6. Header 桌面 Tab 无溢出处理,窄桌面被截
- **`src/components/header.tsx:79-99`** — `<nav className="hidden lg:flex ... ml-2">` 内 5 组 Tab,每项 `px-3 h-full` **无 `overflow-x-auto` / `flex-wrap` / `min-w-0`**。
- **`header.tsx:105`** — 日期 span `shrink-0 whitespace-nowrap`,加上右侧番茄徽标 + 设置按钮。
- **问题**:lg(1024px)边界时 Tab 区 + 日期 + 右侧图标群挤满,日期或 Tab 被裁。用户启用"院校"等更多可见项时会更严重。
- **修法**:Tab 容器加 `overflow-x-auto`;日期降级为 `hidden xl:inline`。

### 7. 番茄钟环形覆盖层(低风险,复查)
- **`src/components/pomodoro-timer.tsx:105-120`** — absolute inset-0 居中,`text-4xl/5xl/6xl` 倒计时 + pill。
- **问题**:移动端环 w-56(224px)内 `text-4xl`"25:00"约 110px,尚可;lg 环 w-72(288px)内 `text-6xl`"25:00"约 180px,接近内径边缘,若用户自定义长时长(如"60:00")更宽 → 贴边。**低优先级,自定义时长输入加长度限制即可根治。**

### 8. 打卡成功态整屏居中
- **`src/app/(authenticated)/checkin/page.tsx:97-95`** — 提交后返回 `flex flex-1 items-center justify-center` 的全屏 🎉 视图,与其它页面(列表/表单)的滚动布局完全不同,体感"跳模式"。
- **修法**:改为卡片内联成功区,或保持但限高、居中在内容区而非整屏。

---

## 二、页面拼合痕迹 / 割裂感(结构性,影响"用起来不连贯")

### A. 两套设计语言并存——这是割裂感的根因

**新语言**(2026-08 几轮统一):`bg-card border border-border/50 shadow-sm rounded-2xl` 卡片、`focus:ring-brand/20`、`rounded-full bg-brand` 大胶囊按钮、`text-muted-foreground` 弱化文字、`rounded-2xl bg-muted` 分段控件。

**旧语言**:`bg-white dark:bg-gray-800 rounded-lg border`、`focus:ring-blue-500`、`bg-blue-500` 主色、`text-gray-400/500` 弱化文字、矩形小按钮。

| 页面 | 容器/卡片 | 输入 focus | 分段控件 | 按钮 |
|------|-----------|-----------|---------|------|
| `/dashboard` 工作台卡 | ✅ 新 | — | — | ✅ 胶囊 |
| `/settings` `/profile` `/leaderboard` `/user/[id]` `/support` `/suggestions` `/admin` | ✅ 新 | ✅ brand | ✅ `rounded-2xl bg-muted` | ✅ 胶囊 |
| `/practice/_components/session-creator.tsx` | ✅ 新 | ✅ brand | ✅ `rounded-2xl` | ✅ 胶囊 |
| `/goal` `goal/page.tsx:80` | ❌ `bg-white dark:bg-gray-800 p-6 rounded-lg border` | ❌ `focus:ring-blue-500`(`:85` `:91` `:96` `:113`) | — | ❌ 矩形 |
| `/checkin` `checkin/page.tsx:105` | ❌ 同上 | ❌ `focus:ring-blue-500`(`:115` `:152`) | — | ❌ 矩形 |
| `/feedback` | ❌ 旧卡片 + `blue-50→purple-50` 渐变头 | ❌ | — | ❌ |
| `/practice` 历史/结果 `practice/page.tsx:398` `result-view.tsx` | ❌ 旧卡片 `rounded-lg border-l-4` | — | — | ❌ |
| `/wrong-questions` `:187` `:214` `:242` | ❌ 旧卡片 | — | ❌ `bg-gray-100 dark:bg-gray-800 rounded-lg p-1`(旧)vs settings 的 `rounded-2xl bg-muted` | ❌ |
| `/study-path` `:206` | ❌ 旧卡片 | — | — | ❌ |
| `/materials` `:163` `:199` | ❌ 旧卡片 | — | — | ❌ |
| `/pomodoro` `pomodoro/page.tsx:509`、`pomodoro-history.tsx` | ❌ 旧卡片 | — | — | ❌ |
| `/chat` `chat/page.tsx:454` `:474` | ❌ 旧卡片 + 用户气泡 `bg-blue-500` | ❌ `focus:ring-blue-500` | — | ❌ |
| `/knowledge-graph` `knowledge-graph-client.tsx` | ❌ 旧卡片 | — | — | ❌ |
| `/login` | ❌ `bg-gray-50 rounded-lg` `focus:ring-blue-500` | ❌ | — | ❌ |
| `/admission`(隐藏)`admission/page.tsx` | ❌ 旧 | ❌ `bg-blue-600` | — | ❌ |
| `loading.tsx` `error.tsx` | ❌ spinner `border-blue-500`、错误按钮 `bg-blue-500` | — | — | ❌ |

- **证据示例**:同页混用——`tasks/page.tsx:350-365` 阶段卡用旧 `border-gray-200 bg-white dark:bg-gray-800`,而冲刺横幅用新渐变;`wrong-questions` 的分段控件(`bg-gray-100 rounded-lg`)和 `settings` 的分段控件(`rounded-2xl bg-muted`)是两种风格。
- **根治**:先定 token 别名(如 `--card`、`--muted` 已有),再逐页把 `bg-white dark:bg-gray-800` → `bg-card`、`rounded-lg border` → `rounded-2xl border border-border/50`、`focus:ring-blue-500` → `focus:ring-brand/20`、`bg-blue-500` → `bg-brand`、`text-gray-500` → `text-muted-foreground`。**不要边用边改,先做一次全库替换再人工过一遍。**

### B. 容器宽度不一致——切页面时内容突然变宽/变窄

| 页面 | 容器 |
|------|------|
| `/dashboard` | **无 max-w(全宽)**(`dashboard/page.tsx:207`) |
| `/chat` | **全宽** |
| `/knowledge-graph` | `max-w-7xl`(`:293`) |
| `/tasks` | `max-w-5xl`(`:326`) |
| `/wrong-questions` `/study-path` | `max-w-3xl`(`:167` `:186`) |
| `/goal` `/practice` `/materials` `/settings` `/profile` `/leaderboard` `/feedback` | `max-w-2xl`(`:74` `:313` `:125` `:136` `:110` `:62`) |
| `/checkin` | **`max-w-md`**(最窄,`:99`) |

- **体验**:从 `max-w-md` 的打卡页跳到 `max-w-5xl` 的计划页,或从全宽图表跳到窄表单,内容视觉宽度突变 → "割裂"。
- **修法**:统一为**一个档位**(推荐 `max-w-3xl` 做内容页基准;dashboard/chat/图谱这类大图页用 `max-w-6xl`)。全库只保留 2 个宽度档。

### C. 页面标题区格式不统一
- **有副标题**:goal/checkin/tasks/feedback/materials/wrong-questions/study-path/chat/knowledge-graph。
- **无副标题(光杆标题)**:`practice/page.tsx:314`"练习"、settings、profile、leaderboard、suggestions。
- **全不同样式**:dashboard 是渐变 banner,leaderboard 是"标题+分段控件右对齐",chat 是"标题+按钮右对齐",其余是"标题+副标题"。
- **修法**:抽一个 `PageHeader` 组件(`title` + 可选 `description` + 可选 `actions`),全站替换;副标题统一 `text-muted-foreground text-sm`。

### D. "相关模块"补丁——最明显的拼合痕迹
- **有**:`tasks/page.tsx:436-443`、`checkin/page.tsx:163-170`、`feedback`、`wrong-questions:290`、`study-path:338`、`practice/_components/result-view.tsx` 尾部都有手贴的一排 `相关模块` 胶囊链接。
- **无**:goal、materials、practice 主页面、chat、pomodoro、settings、profile。
- **问题**:这是页面拼合时应急加的跳转补丁——**哪些页面有、放哪、长什么样全不一致**。用户点"相关模块"进别的页面,但对方页面并不会对称地引回来 → 单向箭头,死胡同感。
- **修法**:① 全部删除,改为在页面间做真正的上下文链接(见第五节联动建议);② 或统一做成一个 `RelatedModules` 组件并全局对称补齐,至少保证 A→B 必有 B→A。

### E. tasks 页"全部任务历史"是空壳
- **`src/app/(authenticated)/tasks/page.tsx:428-433`**
  ```tsx
  <details className="bg-white dark:bg-gray-800 rounded-xl border p-5">
    <summary className="font-bold cursor-pointer">📋 全部任务历史</summary>
    <div className="mt-3 text-sm text-gray-500">当前显示本周任务。点击上方 ◀ ▶ 按钮可以查看其他周的计划。</div>
  </details>
  ```
- **问题**:一个 `<details>` 只放了一行提示文字,**没有任何任务历史数据**——典型的半成品/死壳。用户点开期待看到历史,结果一句话。这是最容易被用户指为"割裂"的地方。
- **修法**:要么实现真正的历史列表(复用 `GET /api/tasks` 带 weekStart 遍历),**要么直接删掉这个空壳**。强烈建议先删,避免留死胡同。

### F. 交互反馈不统一:浏览器弹窗 vs 内联反馈
- **`confirm()` 删除确认**(全部是浏览器原生弹窗):`tasks/page.tsx:250`、`practice/page.tsx:455`、`wrong-questions/page.tsx:101`、`materials/page.tsx:92`、`admission/page.tsx:567`。
- **`alert()` 保存/成功提示**:`settings/page.tsx:56`(导出失败)`124` `125`、`admission/page.tsx:119` `121`、`batch-import-modal.tsx:27` `30` `35`、`wrong-questions/page.tsx:117`、`admin/user-reset.tsx:37`。
- **问题**:settings 是新设计页却用 `alert('✅ 界面偏好已保存')`,与它在页面内其他部分的克制风格冲突;各页成功/失败反馈形态三四种。
- **修法**:抽 `ConfirmDialog` + `Toast`(shadcn 有 `sonner`/`toast` 基础),删除统一走确认弹窗,保存/错误统一走 toast。**至少把 settings 的 alert 换成内联或 toast。**

### G. 弹窗/模态各写各的
- 全库**没有复用统一的 Dialog 组件**,全部手写:chat 错题本弹窗 `chat/page.tsx:468-476`、materials 查看弹窗 `materials/page.tsx:199`、tasks 编辑/添加弹窗 `tasks/page.tsx:448` `490`、wrong-questions 批量导入、AI 面板。
- **问题**:遮罩深浅(`bg-black/40`)、圆角、标题栏、关闭方式、z-index 各页微差。
- **修法**:抽一个 `Modal`(`遮罩 + backdrop-blur + 居中卡片 + esc/点击遮罩关闭`),替换全部手写弹窗。

### H. 数据加载方式不统一 → 加载/错误/刷新观感不一致
- dashboard 是 **Server Component 直连 Prisma**;practice/wrong-questions 用 **React Query**;chat/tasks/goal/checkin/feedback/materials/settings 用 **原生 fetch + useState**。
- 后果:loading 态(有的显示"加载中...",有的无反馈)、错误态(有的 console.error + 静默,有的 alert,有的 inline)、刷新逻辑完全不同。页面加载节奏不一 → 割裂。
- **修法(长期)**:统一上 React Query + 一个 `useApi` hook;短期至少统一 loading/error 组件(见第五节)。

---

## 三、易忽略但真实存在的细节不一致

1. **图标体系**:`pomodoro-timer.tsx` / `pomodoro-history.tsx` / 部分 header 用 **lucide-react** 图标,其余页面**全部用 emoji**。番茄钟页面是唯一混用 lucide 的模块页。→ 二选一,建议全站 emoji(轻量一致),或全站 lucide。
2. **无障碍缺失**:部分页有 `htmlFor`(goal/checkin/login 较好),`tasks/page.tsx:448` 弹窗里 `<label>` 无 `htmlFor`;部分 icon-only 按钮有 `aria-label`(删除 ✕、weekly-planner 的 ↻ `weekly-planner.tsx:189-195` 只有 `title` 无 aria-label);leaderboard 周期按钮无 `aria-pressed`。
3. **`/checkin` 是唯一 `max-w-md` 页面** + 提交后整屏成功态,体感最"独特"。
4. **login 页仍是旧语言**(`bg-gray-50 dark:bg-gray-900`、`rounded-lg`、`focus:ring-blue-500`)——用户每次登录都看到与主站不一致的界面。
5. **`loading.tsx` / `error.tsx` 用 `border-blue-500` / `bg-blue-500`**(旧主色),与 `--brand` 不符。
6. **header 侧滑菜单 w-64**,内容 16 项,未滚动时底部"退出登录"可能贴底 —— 需复查 `overflow-y-auto` + 底部 padding。

---

## 四、优先级建议(整改顺序)

| 优先级 | 动作 | 涉及文件 | 工作量 |
|--------|------|---------|--------|
| **P0** | 修对话页高度硬编码(错版主因) | `chat/page.tsx:273` | 10 分钟 |
| **P0** | 删 tasks"全部任务历史"空壳 | `tasks/page.tsx:428-433` | 5 分钟 |
| **P1** | 修热力图月份标签偏移 | `heatmap.tsx:114-127` | 15 分钟 |
| **P1** | 周计划 7 列 chips 换行 | `weekly-planner.tsx:173,206` | 20 分钟 |
| **P1** | tasks 各科进度行 wrap | `tasks/page.tsx:377-391` | 15 分钟 |
| **P1** | 全库容器宽度统一(2 档) | 全部 page.tsx | 1 小时 |
| **P1** | `bg-white dark:bg-gray-800`→`bg-card` + `focus:ring-blue-500`→`focus:ring-brand/20` 全库替换 | 全部 | 2 小时(可脚本化 + 人工过) |
| **P2** | 抽 `PageHeader` / `Modal` / `ConfirmDialog` / `Toast` 四个基础组件并替换 | 全部 | 半天 |
| **P2** | 统一"相关模块"策略(删除或组件化对称) | 6 处 | 30 分钟 |
| **P2** | login / loading / error 换新语言 | `login/page.tsx` 等 | 1 小时 |
| **P3** | header 溢出处理 | `header.tsx:79-105` | 15 分钟 |
| **P3** | 无障碍补齐 | 各处 | 2 小时 |

---

## 五、模块联动建议(把"相关模块补丁"换成真正的上下文链接)

当前"死胡同"本质是**页面之间没有双向、上下文相关的链接**,只在几个页面底部贴了单向 pill。建议:

1. **目标页 → 计划页**:`goal` 保存目标后,出现"🚀 去生成周计划"主按钮跳 `/tasks`(而不是只靠底部 pill)。
2. **打卡页 → 排行榜**:打卡成功态加"🏆 看看这周排名"。
3. **练习结果 → 错题本**:`result-view` 已把错题"加入错题本",结果页应显示"📕 已收录 X 道错题 → 去复习"。
4. **周报 → 练习/错题**:`feedback` 中"练习分数 vs 目标差距"的图表旁加"去练习/去刷错题"。
5. **学习路径 ↔ 错题本**:路径里程碑提示错题时,点里程碑直接跳错题本对应科目筛选(`/wrong-questions?subject=xxx`——需 API 支持)。
6. **Dashboard 快速操作**已做了一部分,但 `快捷练习`、`到期错题` 的跳转要保持 URL 参数(如 `/wrong-questions?dueToday=true`),让"点进来就已经筛好"。

---

## 六、诚实说明(这份报告没覆盖的)

- 未逐行检查全部 47 个 API 的 UI 关联;只读页面/组件层。
- 未在真机 iOS Safari 上验证地址栏收缩问题(本地环境受限),`chat/page.tsx:273` 的 dvh 问题是**代码推断**,建议本地改完后真机过一遍移动端。
- admission 已隐藏,但其内部仍是旧语言,启用前需一并整改。
