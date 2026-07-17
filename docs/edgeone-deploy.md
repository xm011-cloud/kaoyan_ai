# 部署到腾讯云 EdgeOne Pages（国内免费）

## 架构

```
用户（国内） → EdgeOne Pages CDN → Next.js SSR/API
                                    ↓
                              Neon DB（海外，免费）
                              Supabase Auth（海外，免费）
```

- 前端/页面通过国内 CDN 秒开
- API 路由在 EdgeOne 国内节点运行
- 数据库和认证保持海外（Neon + Supabase），延迟高一些但免费

## 部署步骤

### 1. 登录 EdgeOne Pages

访问 https://console.cloud.tencent.com/edgeone/pages

用微信/QQ/手机号登录腾讯云即可。

### 2. 创建项目 → 导入 Git 仓库

- 授权 GitHub → 选择 `c6` 仓库 → 选择 `dev` 分支
- 框架自动识别为 Next.js
- 构建命令已通过 `edgeone.json` 配置好

### 3. 配置环境变量

在项目设置 → 环境变量中添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Neon 数据库连接串 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Service Role Key |

### 4. 部署

点击「开始部署」，等待 3-5 分钟构建完成。

### 5. 访问

部署完成后得到一个 `*.edgeone.app` 域名（或绑定自己的域名）。

## ⚠️ 注意事项

1. **数据库延迟**：Neon DB 在美国，EdgeOne 节点在国内，API 请求可能有 200-500ms 额外延迟。对于考研学习助手类应用，首屏 SSR 会慢一点，但客户端交互不受影响。

2. **免费额度**：EdgeOne Pages 公测期间免费，商业化后也将有免费版本。

3. **自定义域名**：如绑定自己的域名，需要 ICP 备案。

4. **每次推送自动部署**：push 到 dev 分支后自动触发重新部署。
