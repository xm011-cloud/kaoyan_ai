# 迁移到 MemFire Cloud 指南

## 背景

MemFire Cloud 是 Supabase 的国产替代，API 完全兼容。
本项目代码已完成适配，只需 4 步即可切换。

## 前置条件

- 本项目已提交到 git（作为回退点）
- 现有 Supabase 中如有用户数据，需手动迁移

## 步骤

### 1. 注册 MemFire Cloud

访问 https://memfiredb.com 注册账号（支持微信/手机号）

### 2. 创建项目

控制台 → 新建项目 → 输入项目名 "c6" → 创建

### 3. 获取连接信息

项目创建完成后，进入项目设置，复制以下值：

| 字段 | 位置 | 对应环境变量 |
|------|------|-------------|
| Project URL | 设置 → API | `NEXT_PUBLIC_MEMFIRE_URL` |
| Anon Key | 设置 → API | `NEXT_PUBLIC_MEMFIRE_ANON_KEY` |
| Service Role Key | 设置 → API | `MEMFIRE_SERVICE_ROLE_KEY` |
| DB 连接串 | 设置 → 数据库 | `MEMFIRE_DATABASE_URL` |

### 4. 配置 .env

将上面 4 个值填入项目根目录的 `.env` 文件：

```env
NEXT_PUBLIC_MEMFIRE_URL=https://xxxxx.memfiredb.com
NEXT_PUBLIC_MEMFIRE_ANON_KEY=eyJ...
MEMFIRE_SERVICE_ROLE_KEY=eyJ...
MEMFIRE_DATABASE_URL=postgresql://postgres:password@db.xxxxx.memfiredb.com:5432/postgres
```

### 5. 启用 pgvector 并推送 Schema

```bash
# MemFire Cloud 的 PG 已内置 pgvector，执行以下命令启用扩展
# （如果控制台数据库页面可以一键开启 pgvector，直接开启；否则连上后手动执行）

# 推送 Prisma schema
npx prisma db push
```

### 6. 验证

```bash
npm run build   # 确认编译通过
npm run dev     # 启动后访问 http://localhost:3000
```

- 注册新用户 → 确认能用
- 设置目标 → 确认 DB 写入正常
- 上传资料 → 确认 Storage 正常

### 7. （可选）迁移现有数据

```
# 导出 Supabase 数据
pg_dump "$SUPABASE_DB_URL" > backup.sql

# 导入 MemFire Cloud
psql "$MEMFIRE_DATABASE_URL" < backup.sql
```

## 回退方法

如果遇到问题，改回原 .env 配置即可：

```bash
git checkout main   # 或 dev
# 恢复 .env 中的 Supabase 配置
```

## 注意事项

- MemFire Cloud 免费版有资源限制，具体见官网
- 第一次注册可能需要手机号
- pgvector 扩展在 MemFire Cloud 中默认可用
- 本项目的 `env-config.ts` 同时支持新旧两套环境变量，配了 MemFire 就优先用 MemFire，没配则回退到 Supabase
