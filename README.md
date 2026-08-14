# 🎓 AI 考研助手

> 面向考研学生的 AI 全栈备考平台 —— 目标规划、周计划、每日打卡、错题复习、真题练习、院校情报、AI 对话与自定义技能，一站式备考。

**在线体验：https://c6-orcin.vercel.app** · [Apache-2.0](./LICENSE) · 单作者业余开发，完全免费

---

## ✨ 功能亮点（19 个模块）

### 📅 今日
| 模块 | 说明 |
|------|------|
| 🏠 概览 | 统计卡片、打卡热力图、90 天趋势、今日任务，温柔重入提示 |
| ✅ 打卡 | 学习时长 + 心情 + 备注，排行榜与资料页数据源 |
| 🍅 番茄钟 | 25+5 工作法，SVG 环形计时器，反漂移引擎，后台自动保存 |
| 🏆 学习圈 | 打卡时长排行榜（周/月/全部）、领奖台、公开资料页 |

### 📝 备考
| 模块 | 说明 |
|------|------|
| 🎯 目标 | 院校/专业/日期/科目/分数，专业→科目自动推荐 |
| 📋 计划 | AI 生成周计划 → 评审 → 采纳循环，冲刺模式 |
| ✏️ 练习 | 6 种出题模式（今日巩固/间隔复习/模考/资料出题/真题练习/自定义），AI 判分 |
| 📕 错题本 | SM-2 间隔重复、批量导入、AI 类似题、PDF 导出、真题管理 |

### 🤖 AI
| 模块 | 说明 |
|------|------|
| 💬 AI 对话 | RAG 多轮问答（资料引用）、任务提案、技能运行 |
| ⚡ 技能 | 用户自定义工作流（数据快照+提问+AI 指令+成长档案），对话蒸馏，AI 主动提议 |
| 📊 周报 / 🗺️ 学习路径 | AI 每周分析 / 4 阶段里程碑生成 |

### 📚 知识
| 模块 | 说明 |
|------|------|
| 📖 资料 | PDF/TXT 上传 → pgvector 向量化 → 资料问答 |
| 🧠 知识图谱 | D3 力导向知识点图 |
| 🏫 院校情报 | **社区知识库**：搜索自动落库全局共享、多来源并存、👍认同/⚠️质疑信任机制、Tavily 联网搜索 |

### ⚙️ 设置
AI 自备 Key 模式（MiMo/DeepSeek/通义等 OpenAI 兼容）、驾驶模式三档、界面定制、数据导出、账号注销

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router, Turbopack) · TypeScript strict |
| 样式 | Tailwind CSS 4 · shadcn/ui (base-nova) |
| 数据库 | PostgreSQL (Neon) + pgvector · Prisma 6 (driver adapter) |
| 认证/存储 | Supabase Auth (PKCE) · Supabase Storage（支持 MemFire 兼容切换） |
| AI | 用户自带 OpenAI 兼容 API Key · Function Calling 工具链 · RAG |
| 搜索 | Tavily API（院校情报联网搜索） |
| 图表 | Recharts · D3 子模块 (tree-shaking) |
| 状态 | zustand (persist) · @tanstack/react-query |
| 测试 | Playwright 114 E2E 用例（独立测试库） |

---

## 🏗️ 架构一览

```
用户 → Vercel (Next.js SSR/API)
         ├── Supabase Auth（认证/存储）
         ├── Neon PostgreSQL + pgvector（数据/向量检索）
         └── AI（用户自配 Key：MiMo/DeepSeek/通义等）
              └── Tavily（院校联网搜索）
```

---

## 🧪 质量

- **Playwright 114 个 E2E 用例全绿**（独立测试库 `neondb_test`，不污染开发数据）
- 覆盖全部 19 模块页面、认证重定向、权限、社区反馈、技能系统、AI 配置引导等

---

## 🚀 快速开始

### 在线体验

无需安装，浏览器直接访问 **https://c6-orcin.vercel.app**（注册即用；AI 功能需自配 API Key）。

### 本地开发

```bash
npm install        # 首次自动 prisma generate
cp .env.example .env.local   # 填入 Neon / Supabase 等环境变量
npx prisma db push # 初始化数据库
npm run dev        # http://localhost:3000
```

详细部署（Vercel / EdgeOne）见下方开发者文档。

---

## 📄 协议与合规

- 代码以 [Apache-2.0](./LICENSE) 开源，欢迎学习交流
- 产品数据合规见 [隐私政策](https://c6-orcin.vercel.app/privacy) 与 [用户协议](https://c6-orcin.vercel.app/terms)
- 院校情报数据标注来源仅供参考；真题为个人学习用途导入，不提供共享

---

## 📦 开发者文档

<details>
<summary><b>点击展开：启动 / 部署 / 代码规范</b></summary>

### 环境变量

| 变量 | 说明 | 获取方式 |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 连接串 | [Neon](https://neon.tech) 免费数据库 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | [Supabase](https://supabase.com) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名 Key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务 Key | 同上 |
| `REGISTER_INVITE_CODE` | 注册邀请码（未配置则关闭注册） | 自定 |
| `ADMIN_EMAIL` | 作者后台邮箱（fail closed） | 自定 |
| `TAVILY_API_KEY` | 院校联网搜索（免费 1000 次/月） | [Tavily](https://app.tavily.com) |

用户侧 AI Key（MiMo/DeepSeek/通义等）在设置页自行配置，无需服务端全局 Key。

### 部署

**Vercel（海外推荐）：**
```bash
npx vercel --prod
```

**EdgeOne Pages（国内）：** 详见 [docs/edgeone-deploy.md](./docs/edgeone-deploy.md)

### 数据库

```bash
npx prisma db push   # 推送 Schema
npx prisma studio    # 数据管理界面
```

### E2E 测试

```bash
npx playwright test  # 自动创建独立测试库 + 独立端口 3100
```

### 代码规范

- 路径别名 `@/*` → `./src/*`
- `src/proxy.ts` 为 middleware（Next 16 约定）
- TypeScript strict；新代码与周围风格一致
- 开发规则详见 [README 旧版说明](./docs) 与 [PROJECT_STATUS.md](./PROJECT_STATUS.md)

</details>

---

> 创建于 2026-07 · 持续迭代中 —— 你的 [star ⭐](https://github.com/xm011-cloud/kaoyan_ai) 和 [反馈](https://c6-orcin.vercel.app/suggestions) 是最好的支持
