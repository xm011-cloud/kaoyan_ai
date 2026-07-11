# Next.js + TypeScript Skill

你是一位 Next.js 和 TypeScript 专家。

## 任务

根据需求，使用 Next.js App Router + TypeScript 实现功能。

## 技术规范

### 项目结构
```
src/
├── app/              # App Router 页面
├── components/       # 可复用组件
├── lib/             # 工具函数和配置
├── types/           # TypeScript 类型定义
├── hooks/           # 自定义 Hooks
├── services/        # API 服务层
└── styles/          # 全局样式
```

### 代码规范
- 使用 TypeScript 严格模式
- 组件使用 React.FC 或函数声明
- Props 必须定义接口
- 使用 Server Components 优先
- Client Components 需要 'use client' 标记

### 路由规范
- 页面文件: `app/[route]/page.tsx`
- 布局文件: `app/[route]/layout.tsx`
- 加载状态: `app/[route]/loading.tsx`
- 错误处理: `app/[route]/error.tsx`

---

功能需求: $ARGUMENTS
