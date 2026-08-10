import { NextRequest } from "next/server";
import { jsonNoStore, handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { envConfig } from "@/lib/env-config";
import { prisma } from "@/lib/prisma";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const PUBLIC_URL_PREFIX = `${envConfig.projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/`;

function extFor(mime: string): string {
  const ext: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return ext[mime] || "png";
}

// 上传头像：public avatars 桶（浏览器可直接 <img src>）
// 降级策略：硬失败（500 + 保留旧头像）—— 头像 URL 必须可加载，local: 伪 URL 不适用
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return jsonNoStore({ error: "请选择要上传的图片" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return jsonNoStore({ error: "只支持图片文件" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return jsonNoStore({ error: "图片不能超过 2MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${user!.id}/${Date.now()}_${extFor(file.type)}`;

    let publicUrl: string;
    try {
      const supabase = createServiceClient();
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.find((b) => b.name === BUCKET)) {
        await supabase.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: MAX_SIZE,
        });
      }
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type, // 用 file.type，勿硬编码
        upsert: true,
      });
      if (uploadError) throw uploadError;
      publicUrl = PUBLIC_URL_PREFIX + path;
    } catch (storageErr) {
      console.error("Avatar storage upload failed:", String(storageErr));
      return jsonNoStore({ error: "头像上传失败，请稍后再试" }, { status: 500 });
    }

    // 记录旧头像，便于新头像写库后清理旧对象
    const prev = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { avatar: true },
    });
    await prisma.user.update({ where: { id: user!.id }, data: { avatar: publicUrl } });

    // best-effort 删除旧头像对象（仅当旧值属于 avatars 桶，防误删其它对象）
    if (prev?.avatar && prev.avatar.startsWith(PUBLIC_URL_PREFIX)) {
      const oldPath = prev.avatar.slice(PUBLIC_URL_PREFIX.length);
      createServiceClient()
        .storage.from(BUCKET)
        .remove([oldPath])
        .then(({ error: delErr }) => {
          if (delErr) console.warn("Old avatar cleanup failed:", delErr.message);
        });
    }

    return jsonNoStore({ avatarUrl: publicUrl });
  } catch (err) {
    return handleApiError(err, "上传头像");
  }
}
