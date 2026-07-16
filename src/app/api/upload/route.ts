import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/rag";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
    }

    // 限制文件大小（20MB）
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过 20MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成唯一文件名
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${user!.id}/${timestamp}_${safeName}`;

    // 上传到 Supabase Storage（如果不可达，跳过存储仅记录元数据+内容）
    let storagePath = filePath;
    try {
      const supabase = createServiceClient();
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketName = "materials";
      if (!buckets?.find((b) => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 20971520,
        });
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.warn("Storage upload failed, storing content only:", uploadError.message);
        storagePath = `local:${filePath}`;
      }
    } catch (storageErr) {
      console.warn("Storage not available, storing content only:", String(storageErr));
      storagePath = `local:${filePath}`;
    }

    // 获取文件类型
    let type = "other";
    if (file.type === "application/pdf") type = "pdf";
    else if (file.type.includes("word")) type = "word";
    else if (file.type.startsWith("image/")) type = "image";
    else if (file.type === "text/plain") type = "text";

    // 提取文本内容（用于 RAG 智能问答）
    const content = await extractText(buffer, file.type);

    // 保存记录到数据库
    const material = await prisma.material.create({
      data: {
        userId: user!.id,
        name: file.name,
        type,
        url: storagePath,
        size: file.size,
        content,
      },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        url: true,
        createdAt: true,
      },
    });

    // 异步生成并存储向量嵌入（fire-and-forget，不阻塞上传响应）
    if (content && !content.startsWith("[")) {
      import("@/lib/vector").then(({ storeEmbedding }) =>
        storeEmbedding(material.id, content).catch((e) =>
          console.error("Embedding storage failed (non-blocking):", e)
        )
      );
    }

    return NextResponse.json({ material, hasContent: !!content && !content.startsWith("[") });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 });
  }
}
