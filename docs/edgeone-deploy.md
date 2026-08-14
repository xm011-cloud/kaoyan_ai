# 部署到腾讯云 EdgeOne Pages（国内访问入口）

> 更新：2026-08-14 — ⚠️ **已尝试，Cloud SSR 函数包超 128MiB 限制（143MiB），暂缓**。备选见文末。
> 目的：Vercel 的 `*.vercel.app` 域名国内访问不稳定，EdgeOne Pages 曾作为国内用户访问入口候选。

## 架构（双部署）

```
国内用户 → EdgeOne Pages（*.edgeone.app，国内 CDN + 国内节点 SSR/API）
海外用户 → Vercel（c6-orcin.vercel.app）
                          ↓ 共享
              Neon DB（海外）· Supabase Auth（海外）· Tavily（搜索）
```

- 前端/页面通过国内 CDN 秒开
- API 路由在 EdgeOne 国内节点运行
- 数据库/认证保持海外（与隐私政策"数据存储于海外"告知一致；将来迁国内 DB 后统一迁移）

## 部署步骤

### 1. 登录 EdgeOne Pages

访问 https://console.cloud.tencent.com/edgeone/pages

用微信/QQ/手机号登录腾讯云即可。

### 2. 创建项目 → 导入 Git 仓库

- 授权 GitHub → 选择 `kaoyan_ai` 仓库 → 选择 `dev` 分支
- 框架自动识别为 Next.js
- 构建命令已通过 `edgeone.json` 配置好（`npx prisma generate && npm run build`，Node 22.11）

### 3. 配置环境变量

在项目设置 → 环境变量中添加以下变量（**与 Vercel 生产一致**）：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Neon 数据库连接串（与 Vercel 同一个库，数据共享） |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Service Role Key |
| `TAVILY_API_KEY` | `tvly-...` | 院校联网搜索（与 Vercel 同一个 key） |
| `ADMIN_EMAIL` | 作者邮箱 | 作者后台（fail closed） |
| `REGISTER_INVITE_CODE` | （可留空） | 已弃用（开放注册，配置无影响） |

### 4. 部署

点击「开始部署」，等待 3-5 分钟构建完成。

### 5. 访问

部署完成后得到一个 `*.edgeone.app` 域名（国内可访问）。推广时指向此域名（或绑定自己的域名）。

## ⚠️ 注意事项

1. **数据库延迟**：Neon DB 在美国，EdgeOne 节点在国内，API 请求有 200-500ms 额外延迟。首屏 SSR 稍慢，客户端交互（打卡/番茄钟等）不受影响；院校搜索/AI 调用本身耗时更久，感知不明显。

2. **登录体验**：Supabase Auth 在海外，PKCE 登录流程多一跳，国内登录可能 1-3s，可接受。

3. **免费额度**：EdgeOne Pages 公测期间免费（以控制台当前政策为准）。部署前先确认免费套餐仍可用。

4. **自定义域名**：绑定自己的域名需 ICP 备案；`*.edgeone.app` 分配域名一般无需备案即可用。

5. **每次推送自动部署**：push 到 dev 分支后自动触发重新部署（与 Vercel 双线各自独立部署）。

6. **一致性**：两个平台共享同一数据库与认证，用户数据互通；只是访问入口不同。

## ⚠️ 已知问题（2026-08-14 实测）

- **Cloud SSR Node functions package size 超 128MiB 限制（143MiB）**：全栈 Next.js（App Router + API 路由）+ Prisma driver adapter + mermaid 等重型依赖，函数包过大。
- 已尝试：移除未使用依赖（lucide-react -29MB）、`externalNodeModules` 扩充（mermaid/recharts/@base-ui）—— **仍未解决**（EdgeOne Pages 对 Next.js 全栈的打包机制限制）。
- **结论：EdgeOne Pages 不适合当前全栈架构，暂缓。**

## 备选方案（国内访问入口）

### A. 腾讯云轻量应用服务器 + Docker（推荐）
- 2C2G ~¥60/月，**无函数包限制**（容器化部署 Next.js standalone）
- 步骤：买服务器 → 装 Docker → 拉代码 → 配 env（同 Vercel）→ `docker build` + 起容器 → nginx 反代
- 绑域名需 ICP 备案（1-2 周）；**IP 直访（http://公网IP）无需备案，可先用**
- 数据/认证复用现有 Neon + Supabase，用户数据自动互通

### B. 腾讯云 CloudBase 云托管 / 阿里云 SAE
- 函数包限制更宽，但需验证 Next.js 16 支持度，配置复杂
