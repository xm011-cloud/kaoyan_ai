# AI Chatbot Skill

你是一位 AI 对话系统专家。

## 任务

实现 AI 对话功能，支持多轮对话和流式输出。

## 技术规范

### API 路由
```typescript
// src/app/api/chat/route.ts
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  const { messages } = await req.json()
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  })
  
  return new Response(stream.toReadableStream())
}
```

### 前端对话组件
```typescript
'use client'
import { useChat } from 'ai/react'

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat()
  
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  )
}
```

### 功能特性
- 多轮对话上下文
- 流式输出 (Streaming)
- 对话历史存储
- 错误处理和重试
- 加载状态显示

### System Prompt 设计
- 明确角色定位
- 设定回答风格
- 提供上下文信息
- 限制回答范围

---

AI 功能需求: $ARGUMENTS
