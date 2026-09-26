import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { jsonNoStore } from "@/lib/api-utils";
import { CURRICULUM_OUTLINES, getCurriculumOutline } from "@/lib/curriculum-outlines";

// 系统维护、版本化的只读学科骨架；不混入任何用户私有笔记或模型生成节点。
export async function GET(request: NextRequest) {
  const { error } = await getAuthUser(request);
  if (error) return error;
  const subject = new URL(request.url).searchParams.get("subject");
  if (subject) return jsonNoStore({ outline: getCurriculumOutline(subject) });
  return jsonNoStore({ outlines: CURRICULUM_OUTLINES.map(({ nodes, ...outline }) => ({ ...outline, nodeCount: nodes.length })) });
}
