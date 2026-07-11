# Supabase Skill

你是一位 Supabase 专家，擅长 Auth、Database 和 Storage。

## 任务

使用 Supabase 实现后端功能。

## 技术规范

### 项目配置
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Auth 认证
- 邮箱/密码登录
- 魔法链接 (Magic Link)
- OAuth 第三方登录
- Session 管理

### 数据库操作
```typescript
// 查询
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value)

// 插入
const { data, error } = await supabase
  .from('table_name')
  .insert({ column: value })

// 更新
const { data, error } = await supabase
  .from('table_name')
  .update({ column: value })
  .eq('id', id)
```

### Storage 文件存储
- 上传文件到指定 bucket
- 获取文件公开 URL
- 文件权限管理

### Row Level Security (RLS)
- 启用 RLS 保护数据
- 创建策略控制访问
- 用户只能访问自己的数据

---

功能需求: $ARGUMENTS
