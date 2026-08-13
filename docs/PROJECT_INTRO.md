# AI 考研助手 — 项目功能与 UI 设计介绍

> 本文档面向宣传 / 外部 AI 评估用途,内容基于**实际代码与已部署功能**撰写,不含虚构或夸大。最后核验日期:2026-08-13(对应 dev 分支 e597021)。

---

## 一、一句话定位

**AI 考研助手**是一个面向考研学生的 AI 全栈备考平台,用一条链路覆盖"定目标 → 生成计划 → 每日学习 → 刷题练习 → 错题复习 → 知识图谱 → 学习圈社交 → 数据导出"的完整备考周期。单作者业余开发,封闭邀请制(固定邀请码),所有功能免费,已部署上线。

**线上地址**:https://c6-orcin.vercel.app

---

## 二、项目概况(关键数字)

| 维度 | 数值 |
|------|------|
| 功能模块 | 19 个 |
| API 路由 | 47 个 |
| 数据库模型 | 19 个 |
| E2E 测试用例 | 91 个(全绿) |
| 迭代轮次 | 5 轮(2026-08 集中迭代) |
| 规模 | 单作者、业余开发、全免费 |
| 形态 | 封闭邀请制(固定邀请码注册) |

---

## 三、技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16.2.10(App Router、Turbopack)、React 19.2.4、TypeScript 5 strict |
| 样式 | Tailwind CSS v4 + shadcn/ui(base-nova,CSS 变量)、tw-animate-css、Base UI |
| 数据库 | PostgreSQL(Neon 免费档)+ pgvector 向量扩展 |
| ORM | Prisma 6(driver adapter:`@prisma/adapter-pg` + `pg.Pool`) |
| 认证/存储 | Supabase Auth(PKCE)+ Supabase Storage(公开 avatars 桶);兼容 MemFire Cloud 一键切换 |
| AI | MiMo v2.5-pro(OpenAI 兼容 API),支持用户自带 Key/URL/Model |
| 图表 | Recharts(Dashboard)+ D3 子模块 tree-shaking(知识图谱,节省约 3.8MB) |
| 状态 | zustand(persist)+ @tanstack/react-query |
| 测试 | Playwright 91 用例 |
| 部署 | Vercel 主站;EdgeOne Pages 国内备选(见 docs/edgeone-deploy.md) |
| PWA | manifest + Service Worker + offline 兜底页,可安装到桌面 |

---

## 四、功能全景(19 模块逐一说明)

### 📅 今日组

**1. 学习概览 `/dashboard`**(Server Component,直连 Prisma)
- 顶部渐变欢迎 Banner(显示目标院校 + 距考试天数,未设目标则引导去设)
- 快速操作栏:AI 助手 / 打卡 / 专注 / 练习 / 到期错题数(动态高亮)
- 统计卡片:今日任务完成数、本周学习时长与打卡天数、连续打卡天数、任务完成率
- 工作台卡片网格(**可自定义**):今日任务、快捷练习、本周学习趋势柱状图、最近资料、错题概览、快捷入口
- 数据优化:查询 Set/Map 单遍历派生(6→2 次数据库查询),图表限 90 天

**2. 打卡 `/checkin`**
- 每日记录学习时长(分钟)+ 状态(好/一般/疲惫)+ 备注
- 打卡数据是排行榜与公开资料页的**数据源**

**3. 番茄钟 `/pomodoro`**
- 25+5 番茄工作法(时长可自定义:专注/短休/长休/长休间隔)
- SVG 环形计时器;**反漂移引擎**(时间戳累计,不依赖 setInterval 累加,保证计时准确)
- 完成自动进入休息 → 通知(浏览器 Notification)+ 音频提示(Web Audio)
- **跨页面全局状态**:番茄钟运行时在任何页面都可看到进度(Header 徽标 + 底部栏/活动栏)
- 后台自动保存:sessionStorage 持久化 + 完成/中断时写入数据库
- 会话历史列表;支持中断、跳过

**4. 学习圈排行榜 `/leaderboard`**(2026-08 新增)
- 按打卡累计时长排名,时长相同打卡天数多者靠前
- 本周 / 本月 / 全部 三周期切换
- 领奖台前三名(金银铜样式)+ 完整列表 + "我的排名"
- 成员头像(首字符 fallback)+ 点击进入**公开资料页**
- 邮箱脱敏,不暴露他人 email

### 📝 备考组

**5. 目标 `/goal`**
- 设定目标院校 / 专业 / 考试日期 / 科目 / 目标分数
- **科目标准化选择器**:12 个统考 preset + 自主命题科目(统一科目命名,供全站联动)

**6. 计划 `/tasks`**——备考规划中心
- 三阶段卡片(基础→强化→冲刺)+ 各科进度
- 周计划生成 → **AI 评审** → 采纳循环(AI 判断计划合理性)
- 冲刺模式:距考试 < 30 天时显示 🔥 横幅,生成计划强制冲刺阶段(真题/错题/背诵模板)
- 周计划到期提醒(周日弹窗引导生成下周计划)
- 任务增删改、今日/按周视图、来源标记(ai/manual)

**7. 练习 `/practice`**
- 每日一练 + 模拟考试两种模式
- 5 种出题模式(按科目/薄弱点/题型等),AI 自动出题
- AI 判分 + 结果反馈;**定时器 hook + 进行中会话恢复**(刷新/跳页不丢进度)
- React Query hooks 管理请求状态;进行中会话在底部活动栏常驻入口

**8. 错题本 `/wrong-questions`**
- **SM-2 间隔重复算法**(ease factor / interval / nextReviewDate)
- 批量导入(文本/JSON)、AI 生成同类题、PDF 导出
- 来源标注:chat(对话)/manual(手动)/practice(练习)
- URL 参数筛选恢复(如 `?dueToday=true`),Dashboard 到期提醒联动

### 🤖 AI 组

**9. AI 对话 `/chat`**
- **RAG 多轮对话**:基于上传资料(向量检索)作答,引用来源
- Markdown 渲染;一条消息可"加入错题本"

**10. 周报 `/feedback`**
- AI 每周分析学习数据(打卡/练习/错题)生成个性化周报
- 练习分数 vs 目标差距对比

**11. 学习路径 `/study-path`**
- AI 分析薄弱点(错题分布 + 目标分数差距)生成 4 阶段里程碑路径(基础/强化/冲刺/查漏补缺)
- 里程碑进度追踪(checkbox + slider + 目标日期 + AI 建议)
- 无 AI Key 时 fallback 本地生成(4 阶段 × 弱势科目加权)

### 📚 知识组

**12. 资料 `/materials`**
- 上传 PDF/TXT → Supabase Storage → **文本提取 → pgvector 向量化**
- 是 RAG 问答的知识底座

**13. 知识图谱 `/knowledge-graph`**
- **D3 力导向图**可视化知识点 + 关联边(先修/相关/扩展关系)
- 节点按科目/分类着色,权重与掌握度映射
- 5 模块 D3 tree-shaking 优化包体积;AI 辅助构建;节点详情联动错题

**14. 院校情报 `/admission`**(后端完成,前端默认隐藏)
- 后端 API 完成:search / analyze / saved / import
- 院校录取信息按年份存储(score_line/enrollment/subjects/tuition/notes),数据可跨用户共享
- **前端暂未启用**(ui-store 中 `visible:false`,待决定是否接付费 SerpAPI)

### ⚙️ 设置组

**15. 个人资料 `/profile`**(2026-08 新增)
- 昵称编辑 + 头像上传(public avatars 桶,≤2MB,JPG/PNG/WebP/GIF)
- **公开资料页 `/user/[id]`**:查看他人昵称/头像/打卡统计(累计/本周/连续),**不暴露 email**

**16. 设置 `/settings`**
- AI Key / URL / Model(可覆盖全局,自带 Key 用户免费用)
- 学习提醒(时间/星期/通知权限)
- 界面定制:导航分组可见性 / 工作台卡片 / 出题偏好(persist 到 zustand + 用户偏好)
- **数据导出**:一键导出全部学习数据 JSON(排除 Chat 与资料原文,保护版权)

### 🌐 公开 / 运营模块

**17. 支持作者 `/support`**(公开页)
- "请作者喝咖啡 ¥9.9",微信 / 支付宝收款码
- 留言 + **感谢墙(审核后展示)**;蜜罐 + 限流 3/min/IP + 强制金额

**18. 意见反馈 `/suggestions`**(需登录)
- 1-5 星 + 意见 + 匿名开关

**19. 作者后台 `/admin`**(登录 + ADMIN_EMAIL 校验,fail closed)
- 三 Tab:意见反馈(状态流转 new→read→resolved)/ 支持留言审核 / 重置密码
- 重置链接:generateLink → hashed_token 自建链接,跨浏览器免邮件(PKCE 下 action_link 的替代通道)

### 📄 认证页(配套)

- `/login`(邀请码注册 + 登录)、`/forgot-password`、`/update-password`、`/auth/callback`(双模式:PKCE code 交换 + token_hash verifyOtp)、`/`(落地页)、`/about`

---

## 五、UI / UX 设计详解

### 5.1 设计基调:Apple HIG(仿操作系统)

整个应用被设计成**一套"OS 外壳"**,而非传统网页导航。遵循 Apple HIG 三原则:
- **Clarity(清晰)**:单一 Header 取代旧的多栏导航,chrome 极简,内容占满高度
- **Deference(克制)**:低饱和背景 + 卡片分层,突出内容本身
- **Depth(纵深)**:Header 悬浮于内容之上、弹层用 backdrop-blur + shadow 制造层级

布局结构:
```
┌─ Header (h-12,毛玻璃) ──────────────────────────┐
├─ 内容区 (flex-1,滚动) ───────────────────────────┤
├─ ActivityBar (桌面,有活动才显示) ────────────────┤
└─ MobileNav (移动端底部 TabBar) ─────────────────┘
```

### 5.2 设计系统(真实 token 值)

- **颜色**:OKLCH 色彩空间;品牌主色蓝色 `--brand: oklch(0.55 0.18 255)`,深色模式更亮;语义色 success/warning/info/destructive
- **圆角**:基准 `--radius: 0.625rem`,衍生 sm/md/lg/xl/2xl/3xl/4xl 六级缩放
- **卡片语言**:`bg-card border border-border/50 shadow-sm rounded-2xl`,配合 hover 微交互
- **渐变 Hero**:Dashboard / 落地页用品牌色渐变横幅(`from-brand to-primary/80`)
- **图标**:以 Emoji 为主(轻量、直观),部分 UI 控件用 lucide-react
- **明暗主题**:完整浅色/深色两套 token(class 切换)

### 5.3 响应式三端适配

| 端 | 导航形态 | 特点 |
|----|---------|------|
| 桌面 (lg+) | Header 内 5 分组 Tab + 侧滑菜单 | 日期 + 距考试天数显示在顶栏 |
| 平板/窄屏 | 同桌面但 Tab 收敛 | 内容区 max-w 约束居中 |
| 移动端 | 底部 TabBar(5 组) | **活动模式自动切换**(见下) |

**移动端"活动模式"**:当番茄钟运行中或有练习进行时,底部 TabBar **整栏替换为进度条 + 内联控制**(专注状态/倒计时/进度条/暂停·停止按钮),不打断学习流,回到空闲再恢复 TabBar。

### 5.4 全局常驻元素

- **Header**:🎓 logo + 分组 Tab(今日/备考/AI/知识/设置)+ 当前日期 + ⏳ 距考试天数 + 番茄钟实时徽标(运行中显示倒计时,可点击跳转)+ 设置入口
- **侧滑菜单**:点击 logo 弹出,5 分组全部模块 + 退出登录(毛玻璃遮罩 + 左侧滑入)
- **ActivityBar(桌面)**:底部常驻栏,有活动时显示——番茄钟内联控制(暂停/继续/停止,无需跳页)、练习进行中入口、"AI 出题中"状态
- **AI 浮动面板**:全站右下角悬浮,`Cmd+J / Ctrl+J` 唤起,Esc 关闭,支持 Function Calling 工具调用后以**行动卡片**展示结果(如"已创建任务")。对话独立于 /chat 页持久化到 localStorage

### 5.5 关键页面视觉细节

- **学习概览**:渐变欢迎横幅 → 统计卡片 → 快速操作胶囊按钮(带 active:scale 按压缩放)→ 可自定义卡片网格(整宽卡片纵向排、半宽卡片 lg 下两列)
- **学习圈排行榜**:顶部渐变金色"我的排名"卡(amber-50→orange-50)+ 领奖台三张卡(第一名最高,按名次降高)+ 周期 Tab 切换 + 列表行(圆徽章排名 + 头像 + 时长 `tabular-nums` 等宽数字)
- **番茄钟**:`max-w-lg` 居中卡片,SVG 环形计时,专注中红色呼吸提示 / 休息绿色提示 / 暂停黄色提示
- **打卡 / 设置 / 错题**:统一卡片 + 表单控件风格;错题列表支持 URL 参数状态恢复
- **落地页**:Hero + 8 功能卡(icon/标题/描述/三点)+ 三步开始 + 数据亮点 + 渐变 CTA + Footer 链接

---

## 六、数据模型(18 张表)与后端

核心模型(19 个):
`User`(含 AI Key/番茄钟设置/提醒/UI 偏好)、`Goal`、`Task`、`CheckIn`、`Material`(含 pgvector `embedding`)、`Chat`、`Feedback`、`WrongQuestion`(SM-2 字段)、`PracticeSession`、`PomodoroSession`、`AdmissionInfo`(跨用户共享)、`ImportedQuestion`、`SchoolComparison`、`KnowledgeNode` / `KnowledgeEdge`、`StudyPath` / `StudyPathMilestone`、`Supporter`(审核制)、`AuthorFeedback`

**RAG 链路**:上传 PDF/TXT → Supabase Storage → 文本提取 → pgvector 向量化 → 语义检索 → AI 引用来源作答。

**安全实践**:
- 全部 API 经 `getAuthUser`(cookie + Bearer 双通道)+ 每查询 userId 过滤
- 注册:蜜罐 + 生产限流 5/min/IP + `crypto.timingSafeEqual` 邀请码比对 + `admin.createUser({email_confirm:true})` 注册即用
- 支持留言:蜜罐 + 限流 3/min/IP + 强制金额,审核后才上墙
- 后台:ADMIN_EMAIL env 校验,fail closed(未配置全拒)
- 公开资料页 / 排行榜:email 脱敏,不泄露他人信息

---

## 七、测试与质量

- **Playwright 91 用例全绿**:authenticated + unauthenticated 双项目(per-project testMatch)
- 覆盖:全部模块页面加载、认证重定向、PWA 资源、权限控制(admin/suggestions/profile 403/重定向)、导出下载、头像上传、排行榜点击进公开页、支持/反馈/后台
- `tsc --noEmit` strict + `npm run build` 通过

---

## 八、诚实声明(已知局限 / 未完成项)

为便于外部评估,如实列出当前不足:

| 优先级 | 现状 |
|--------|------|
| P1 | **院校情报前端未启用**(后端已完成,依赖付费 SerpAPI 决策,Vercel + 百度反爬风险) |
| P1 | **数据库在 Neon 免费档**,未迁移到生产环境 |
| P2 | 模块间联动较弱,存在"死胡同"页面(点进去无处可去) |
| P2 | 无障碍不完善(部分 htmlFor / aria-label 缺失) |
| P2 | PWA 离线策略简单:导航网络优先,仅 offline.html 兜底,**未缓存 API 数据** |
| P3 | 学习圈社交浅(仅排行榜,**无点赞/互关/动态**) |
| — | 单作者业余开发,无团队、无商业化收入(有支持页但非盈利驱动) |
| — | 用户量极小(封闭邀请,目标场景约 5 人规模) |
| — | 本地环境无法 curl `*.vercel.app`(网络限制),线上功能验证依赖用户在浏览器手动确认 |
| — | E2E 会向开发库写入少量测试数据(打卡/昵称/头像) |

**已实现的完整闭环**(可重点宣传):
目标 → AI 三阶段计划 → 每日任务/打卡 → 番茄钟专注 → 每日一练/模拟考(AI 判分)→ 错题本(SM-2 复习 + AI 同类题)→ AI 周报 → 知识图谱/学习路径 → 学习圈排行榜/公开资料页 → 数据导出(数据主权)。

---

## 九、适合外部 AI 评估的开放问题

1. 一个 5 人规模、全免费、单作者的考研工具,当前功能是否过度设计?哪些模块是核心、哪些该砍?
2. 学习圈仅排行榜是否足够形成留存?下一步该做点赞/互关/动态还是先做模块联动?
3. PWA 离线、无障碍、数据库生产迁移这三件事的优先级排序?
4. 知识图谱/RAG 这类重功能对真实考研用户的价值 vs 维护成本是否划算?
5. 商业化路径(如有)应选:订阅、AI Key 自带(已支持)、打赏、还是面向机构的批量授权?
