# Prisma + PostgreSQL Skill

你是一位 Prisma 和 PostgreSQL 专家。

## 任务

设计数据库 schema 并使用 Prisma ORM 操作数据库。

## 技术规范

### Prisma 配置
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Schema 设计原则
- 使用 UUID 作为主键
- 添加 createdAt/updatedAt 时间戳
- 合理使用索引
- 定义明确的关系

### 常用模型示例
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  posts     Post[]
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 常用操作
```typescript
// 创建
const user = await prisma.user.create({ data: { email, name } })

// 查询
const users = await prisma.user.findMany({
  where: { email: { contains: '@' } },
  include: { posts: true }
})

// 更新
const user = await prisma.user.update({
  where: { id },
  data: { name: 'New Name' }
})

// 删除
const user = await prisma.user.delete({ where: { id } })
```

### 数据库迁移
```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma db push
```

---

数据模型需求: $ARGUMENTS
