/**
 * 系统知识骨架（首批、人工审核）。
 * 这不是题库或教材替代品：只提供稳定的章节导航与前置关系，个人理解仍单独保存在 StudyNote。
 */
export interface CurriculumNode {
  id: string;
  title: string;
  parentId: string | null;
  prerequisites: string[];
}

export interface CurriculumOutline {
  id: string;
  subject: string;
  version: string;
  label: string;
  nodes: CurriculumNode[];
}

const NETWORK_408: CurriculumOutline = {
  id: "408-computer-networking-v1",
  subject: "408计算机",
  version: "v1",
  label: "408 · 计算机网络主干",
  nodes: [
    { id: "network-basics", title: "计算机网络体系结构", parentId: null, prerequisites: [] },
    { id: "network-layering", title: "分层模型与协议", parentId: "network-basics", prerequisites: ["network-basics"] },
    { id: "network-physical", title: "物理层与数据通信基础", parentId: null, prerequisites: ["network-basics"] },
    { id: "network-link", title: "数据链路层", parentId: null, prerequisites: ["network-physical"] },
    { id: "network-ip", title: "网络层与 IP", parentId: null, prerequisites: ["network-link", "network-layering"] },
    { id: "network-routing", title: "路由与转发", parentId: "network-ip", prerequisites: ["network-ip"] },
    { id: "network-transport", title: "传输层", parentId: null, prerequisites: ["network-ip"] },
    { id: "network-tcp", title: "TCP 可靠传输与连接管理", parentId: "network-transport", prerequisites: ["network-transport"] },
    { id: "network-flow", title: "流量控制与拥塞控制", parentId: "network-tcp", prerequisites: ["network-tcp"] },
    { id: "network-application", title: "应用层", parentId: null, prerequisites: ["network-transport"] },
  ],
};

export const CURRICULUM_OUTLINES: CurriculumOutline[] = [NETWORK_408];

export function getCurriculumOutline(subject?: string | null): CurriculumOutline | null {
  if (!subject) return null;
  return CURRICULUM_OUTLINES.find((outline) => outline.subject === subject) ?? null;
}

// 系统节点 ID 在所有已审核骨架中保持唯一，详情查询不能依赖用户私有数据或模型推断。
export function getCurriculumNode(nodeId: string): { outline: CurriculumOutline; node: CurriculumNode } | null {
  for (const outline of CURRICULUM_OUTLINES) {
    const node = outline.nodes.find((item) => item.id === nodeId);
    if (node) return { outline, node };
  }
  return null;
}
