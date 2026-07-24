<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目启动

## 本地开发

```bash
npm run dev          # 启动 Next.js 开发服务器 (Turbopack, 默认 :3000)
npx tsc --noEmit     # TypeScript 类型检查
npx playwright test  # E2E 测试
```

## 构建 & 部署

```bash
npm run build        # 生产构建
npx vercel --prod    # 部署到 Vercel
```

## 数据库

```bash
npx prisma db push   # 推送 Schema 到数据库
npx prisma generate  # 重新生成 Prisma Client
npx prisma studio    # 打开 Prisma 数据管理界面
```

## 关键约定

- 环境变量: `.env.local` (本地) / `.env` (共享)
- 认证: Supabase Auth (支持 MemFire Cloud 替代，相同 SDK)
- AI: OpenAI 兼容 API (默认 MiMo `https://api.xiaomimimo.com/v1`)
- 数据库: PostgreSQL + pgvector (Neon 免费)
- Prisma: driver adapter 模式 (`@prisma/adapter-pg` + `pg.Pool`)，不是传统直连
- Middleware 在 `src/proxy.ts` (Next.js 16 convention)
- Tailwind CSS v4 + shadcn/ui (base-nova, CSS variables)
- 路径别名 `@/*` → `./src/*`
- 开发规则详见 [README.md](./README.md)
- 项目状态详见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)
