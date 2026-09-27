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
  source: {
    label: string;
    url: string;
    reviewedAt: string;
  };
  nodes: CurriculumNode[];
}

const OUTLINE_SOURCE = {
  label: "教育部教育考试院《全国硕士研究生招生考试计算机学科专业基础考试大纲》（2022）",
  url: "https://yankao.neea.edu.cn/xhtml1/category/1509/6235-1.htm",
  reviewedAt: "2026-09-26",
};

const NETWORK_408: CurriculumOutline = {
  id: "408-computer-networking-v1",
  subject: "408计算机",
  version: "v1",
  label: "408 · 计算机网络主干",
  source: OUTLINE_SOURCE,
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

// 第一批扩展只覆盖 408 数据结构的考试主干。章节与前置关系经过人工整理，
// 不把题库、教材内容或模型生成内容混入系统骨架。
const DATA_STRUCTURES_408: CurriculumOutline = {
  id: "408-data-structures-v1",
  subject: "408计算机",
  version: "v1",
  label: "408 · 数据结构主干",
  source: OUTLINE_SOURCE,
  nodes: [
    { id: "ds-foundations", title: "数据结构与算法基础", parentId: null, prerequisites: [] },
    { id: "ds-linear-list", title: "线性表", parentId: null, prerequisites: ["ds-foundations"] },
    { id: "ds-stack-queue-array", title: "栈、队列与数组", parentId: "ds-linear-list", prerequisites: ["ds-linear-list"] },
    { id: "ds-string", title: "串", parentId: "ds-linear-list", prerequisites: ["ds-linear-list"] },
    { id: "ds-tree", title: "树与二叉树", parentId: null, prerequisites: ["ds-foundations"] },
    { id: "ds-graph", title: "图", parentId: null, prerequisites: ["ds-foundations"] },
    { id: "ds-search", title: "查找", parentId: null, prerequisites: ["ds-linear-list"] },
    { id: "ds-sort", title: "内部排序", parentId: null, prerequisites: ["ds-linear-list"] },
  ],
};

const OPERATING_SYSTEM_408: CurriculumOutline = {
  id: "408-operating-system-v1",
  subject: "408计算机",
  version: "v1",
  label: "408 · 操作系统主干",
  source: OUTLINE_SOURCE,
  nodes: [
    { id: "os-overview", title: "操作系统概述", parentId: null, prerequisites: [] },
    { id: "os-process-thread", title: "进程与线程", parentId: null, prerequisites: ["os-overview"] },
    { id: "os-processor-scheduling", title: "处理机调度", parentId: "os-process-thread", prerequisites: ["os-process-thread"] },
    { id: "os-synchronization", title: "同步与互斥", parentId: "os-process-thread", prerequisites: ["os-process-thread"] },
    { id: "os-deadlock", title: "死锁", parentId: "os-synchronization", prerequisites: ["os-synchronization"] },
    { id: "os-memory", title: "内存管理", parentId: null, prerequisites: ["os-overview"] },
    { id: "os-virtual-memory", title: "虚拟内存", parentId: "os-memory", prerequisites: ["os-memory"] },
    { id: "os-file-system", title: "文件管理", parentId: null, prerequisites: ["os-overview"] },
    { id: "os-io", title: "输入输出管理", parentId: null, prerequisites: ["os-overview"] },
  ],
};

const COMPUTER_ORGANIZATION_408: CurriculumOutline = {
  id: "408-computer-organization-v1",
  subject: "408计算机",
  version: "v1",
  label: "408 · 计算机组成原理主干",
  source: OUTLINE_SOURCE,
  nodes: [
    { id: "co-overview", title: "计算机系统概述", parentId: null, prerequisites: [] },
    { id: "co-data-representation", title: "数据表示与运算", parentId: null, prerequisites: ["co-overview"] },
    { id: "co-arithmetic-unit", title: "运算方法与 ALU", parentId: "co-data-representation", prerequisites: ["co-data-representation"] },
    { id: "co-memory", title: "存储系统", parentId: null, prerequisites: ["co-overview"] },
    { id: "co-cache", title: "高速缓存与主存映射", parentId: "co-memory", prerequisites: ["co-memory"] },
    { id: "co-instruction", title: "指令系统", parentId: null, prerequisites: ["co-data-representation"] },
    { id: "co-cpu", title: "中央处理器", parentId: null, prerequisites: ["co-instruction", "co-arithmetic-unit"] },
    { id: "co-pipeline", title: "指令流水线", parentId: "co-cpu", prerequisites: ["co-cpu"] },
    { id: "co-bus", title: "总线", parentId: null, prerequisites: ["co-overview"] },
    { id: "co-io", title: "输入输出系统", parentId: null, prerequisites: ["co-bus", "co-memory"] },
  ],
};

export const CURRICULUM_OUTLINES: CurriculumOutline[] = [NETWORK_408, DATA_STRUCTURES_408, OPERATING_SYSTEM_408, COMPUTER_ORGANIZATION_408];

export function getCurriculumOutline(subject?: string | null): CurriculumOutline | null {
  if (!subject) return null;
  return CURRICULUM_OUTLINES.find((outline) => outline.subject === subject) ?? null;
}

export function getCurriculumOutlineById(outlineId?: string | null): CurriculumOutline | null {
  if (!outlineId) return null;
  return CURRICULUM_OUTLINES.find((outline) => outline.id === outlineId) ?? null;
}

// 系统节点 ID 在所有已审核骨架中保持唯一，详情查询不能依赖用户私有数据或模型推断。
export function getCurriculumNode(nodeId: string): { outline: CurriculumOutline; node: CurriculumNode } | null {
  for (const outline of CURRICULUM_OUTLINES) {
    const node = outline.nodes.find((item) => item.id === nodeId);
    if (node) return { outline, node };
  }
  return null;
}
