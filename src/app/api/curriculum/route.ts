import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { jsonNoStore } from "@/lib/api-utils";
import { CURRICULUM_OUTLINES, getCurriculumOutline, getCurriculumOutlineById } from "@/lib/curriculum-outlines";

// 系统维护、版本化的只读学科骨架；不混入任何用户私有笔记或模型生成节点。
export async function GET(request: NextRequest) {
  const { error } = await getAuthUser(request);
  if (error) return error;
  const searchParams = new URL(request.url).searchParams;
  const outlineId = searchParams.get("outlineId");
  const subject = searchParams.get("subject");
  const includeNodes = searchParams.get("includeNodes") === "true";
  if (outlineId) return jsonNoStore({ outline: getCurriculumOutlineById(outlineId) });
  // 保持旧的按科目查询兼容；同一科目有多个经过审核的骨架时，新调用方应使用 outlineId。
  if (subject) return jsonNoStore({ outline: getCurriculumOutline(subject) });
  // 理解库需要把用户已确认的课程节点 ID 转成可读标签；一次返回少量已审核骨架，
  // 避免页面先拉摘要、再为每个骨架单独请求详情。
  if (includeNodes) return jsonNoStore({ outlines: CURRICULUM_OUTLINES });
  return jsonNoStore({ outlines: CURRICULUM_OUTLINES.map(({ nodes, ...outline }) => ({ ...outline, nodeCount: nodes.length })) });
}
