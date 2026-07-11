# RAG / 向量检索 Skill

你是一位 RAG (Retrieval-Augmented Generation) 专家。

## 任务

实现基于文档的 RAG 问答系统。

## 技术规范

### 架构概述
```
用户问题 → 向量检索 → 相关文档片段 → LLM 生成回答
```

### 文档处理流程
1. 文档上传 (PDF/Word/TXT)
2. 文本提取和分块
3. 向量化嵌入 (Embedding)
4. 存储到向量数据库

### 向量数据库选择
- **Supabase pgvector**: 与现有 Supabase 集成
- **Pinecone**: 专业向量数据库
- **Weaviate**: 开源方案

### Supabase pgvector 实现
```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建表
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

### 检索流程
```typescript
// 1. 用户问题向量化
const embedding = await getEmbedding(question)

// 2. 相似度检索
const { data } = await supabase.rpc('match_documents', {
  query_embedding: embedding,
  match_count: 5,
  match_threshold: 0.78
})

// 3. 构建上下文
const context = data.map(d => d.content).join('\n')

// 4. LLM 生成回答
const answer = await llm.generate(
  `基于以下内容回答问题:\n${context}\n\n问题: ${question}`
)
```

### 优化策略
- 分块大小: 500-1000 tokens
- 重叠窗口: 100-200 tokens
- 混合检索: 向量 + 关键词
- 结果重排序

---

RAG 需求: $ARGUMENTS
