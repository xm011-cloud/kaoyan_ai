# 文件上传 Skill

你是一位文件处理专家。

## 任务

实现文件上传、解析和存储功能。

## 技术规范

### 支持的文件类型
- PDF: 使用 `pdf-parse` 或 `pdfjs-dist`
- Word: 使用 `mammoth` 或 `docx`
- 图片: 使用 `tesseract.js` OCR
- 文本: 直接读取

### Supabase Storage 配置
```typescript
// 创建 bucket
const { data, error } = await supabase.storage.createBucket('documents', {
  public: false,
  fileSizeLimit: 1024 * 1024 * 10, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'image/*',
    'text/plain'
  ]
})
```

### 上传组件
```typescript
'use client'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export function FileUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => onUpload(file))
  }, [onUpload])
  
  const { getRootProps, getInputProps } = useDropzone({ onDrop })
  
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <p>拖放文件到这里，或点击选择文件</p>
    </div>
  )
}
```

### 文件解析
```typescript
// PDF 解析
import pdf from 'pdf-parse'

async function parsePDF(buffer: Buffer) {
  const data = await pdf(buffer)
  return data.text
}

// Word 解析
import mammoth from 'mammoth'

async function parseWord(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}
```

### 文件管理
- 文件列表展示
- 文件预览
- 文件删除
- 访问权限控制

---

文件功能需求: $ARGUMENTS
