# Deployment 部署 Skill

你是一位部署和运维专家。

## 任务

指导项目部署到生产环境。

## 部署方案

### 方案一: Vercel (推荐)
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
vercel --prod
```

### 环境变量配置
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key
```

### 部署前检查清单
- [ ] 环境变量配置完整
- [ ] 数据库迁移完成
- [ ] 构建无错误 (`npm run build`)
- [ ] 类型检查通过 (`npm run type-check`)
- [ ] ESLint 检查通过 (`npm run lint`)
- [ ] 测试通过 (`npm run test`)

### 域名配置
1. 在 Vercel 添加自定义域名
2. 配置 DNS 解析
3. 等待 SSL 证书自动签发

### 监控和日志
- Vercel Analytics: 性能监控
- Sentry: 错误追踪
- Supabase Dashboard: 数据库监控

### 持续部署
- Git push 自动部署
- Preview 部署 (PR)
- 生产部署 (main 分支)

---

部署需求: $ARGUMENTS
