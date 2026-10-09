import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { handleApiError, jsonNoStore } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 私有资料原文件的短时访问入口。
 * 数据库只保存 Storage path，不把它暴露为可猜测的公共对象地址。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    const material = await prisma.material.findFirst({
      where: { id, userId: user!.id },
      select: { url: true },
    });

    if (!material) return jsonNoStore({ error: "资料不存在" }, { status: 404 });
    if (!material.url || material.url.startsWith("local:")) {
      return jsonNoStore({ error: "这份资料没有可打开的原文件副本" }, { status: 409 });
    }

    const supabase = createServiceClient();
    const { data, error: signError } = await supabase.storage
      .from("materials")
      .createSignedUrl(material.url, 60);
    if (signError || !data?.signedUrl) {
      return jsonNoStore({ error: "暂时无法打开原文件，请稍后重试" }, { status: 502 });
    }

    const response = NextResponse.redirect(data.signedUrl, { status: 307 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    return handleApiError(err, "打开资料原文件");
  }
}
