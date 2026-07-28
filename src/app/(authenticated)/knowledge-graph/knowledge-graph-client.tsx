"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { select } from "d3-selection";
import { zoom as d3Zoom } from "d3-zoom";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { drag as d3Drag } from "d3-drag";
import { interpolateRgb } from "d3-interpolate";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import { Button } from "@/components/ui/button";

interface KnowledgeNode {
  id: string;
  name: string;
  subject: string;
  category: string;
  weight: number;
  mastery: number;
}

interface KnowledgeEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  label: string | null;
  from: { id: string; name: string; subject: string };
  to: { id: string; name: string; subject: string };
}

interface GraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  subjects: string[];
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  name: string;
  subject: string;
  category: string;
  weight: number;
  mastery: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  relation: string;
  label: string | null;
  sourceId: string;
  targetId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  concept: "#3B82F6",
  formula: "#F59E0B",
  method: "#10B981",
  theorem: "#8B5CF6",
};

function masteryColor(mastery: number): string {
  if (mastery <= 0.5) {
    const t = mastery / 0.5;
    return interpolateRgb("#EF4444", "#EAB308")(t);
  }
  const t = (mastery - 0.5) / 0.5;
  return interpolateRgb("#EAB308", "#22C55E")(t);
}

export default function KnowledgeGraphClient() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<
    Array<{ id: string; question: string; subject: string; reviewed: boolean }>
  >([]);
  const [message, setMessage] = useState("");

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subjectFilter) params.set("subject", subjectFilter);
      const res = await fetch(`/api/knowledge-graph?${params}`);
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement!;
    const width = container.clientWidth;
    const height = Math.max(500, window.innerHeight - 300);

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);

    if (graphData.nodes.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#9CA3AF")
        .attr("font-size", 14)
        .text("暂无知识图谱数据，请先添加错题后点击「构建图谱」");
      return;
    }

    const simNodes: SimNode[] = graphData.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = graphData.edges
      .filter((e) => nodeMap.has(e.fromId) && nodeMap.has(e.toId))
      .map((e) => ({
        id: e.id,
        relation: e.relation,
        label: e.label,
        sourceId: e.fromId,
        targetId: e.toId,
        source: e.fromId,
        target: e.toId,
      }));

    const g = svg.append("g");
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoomBehavior);

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#9CA3AF");

    const link = g
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#D1D5DB")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    const linkLabel = g
      .append("g")
      .selectAll<SVGTextElement, SimLink>("text")
      .data(simLinks.filter((l) => l.label))
      .join("text")
      .attr("font-size", 10)
      .attr("fill", "#9CA3AF")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text((d) => d.label || "");

    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        setSelectedNode(d);
        fetch(`/api/wrong-questions?subject=${encodeURIComponent(d.subject)}&tag=${encodeURIComponent(d.name)}&limit=20`)
          .then((r) => r.json())
          .then((data) => setWrongQuestions(data.questions || []))
          .catch(() => setWrongQuestions([]));
      });

    node
      .append("circle")
      .attr("r", (d) => 8 + d.weight * 4)
      .attr("fill", (d) => masteryColor(d.mastery))
      .attr("stroke", (d) => CATEGORY_COLORS[d.category] || "#6B7280")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.8);

    node
      .append("text")
      .text((d) => d.name)
      .attr("font-size", 11)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -14 - d.weight * 4)
      .attr("fill", "#374151")
      .attr("font-weight", 500);

    const dragBehavior = d3Drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(dragBehavior);

    node.append("title").text(
      (d) => `${d.name}\n科目: ${d.subject}\n掌握度: ${Math.round(d.mastery * 100)}%\n权重: ${d.weight.toFixed(1)}`
    );

    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide<SimNode>().radius((d) => 14 + d.weight * 4));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      linkLabel
        .attr("x", (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr("y", (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  const handleBuild = async () => {
    setBuilding(true);
    setMessage("");
    try {
      const res = await fetch("/api/knowledge-graph/build", { method: "POST" });
      const data = await res.json();
      setMessage(
        data.success
          ? `✅ 构建完成：${data.nodesCreated} 个知识点，${data.edgesCreated} 条关联`
          : data.message || "构建失败"
      );
      loadGraph();
    } catch {
      setMessage("构建失败");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">🧠 知识图谱</h1>
            <p className="text-sm text-gray-500 mt-1">
              可视化知识点关联，发现薄弱环节
              {graphData && ` · ${graphData.nodes.length} 个节点 · ${graphData.edges.length} 条边`}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">全部科目</option>
              {graphData?.subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button onClick={handleBuild} disabled={building} variant="outline">
              {building ? "构建中..." : "🔄 重建图谱"}
            </Button>
          </div>
        </div>

        {message && (
          <div className="text-sm p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {message}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border overflow-hidden min-h-[500px] relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-gray-400">加载中...</span>
              </div>
            ) : (
              <svg ref={svgRef} className="w-full h-full" />
            )}
          </div>

          {selectedNode && (
            <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{selectedNode.name}</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">科目：</span>
                  <span className="font-medium">{selectedNode.subject}</span>
                </div>
                <div>
                  <span className="text-gray-500">分类：</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: CATEGORY_COLORS[selectedNode.category] + "20",
                      color: CATEGORY_COLORS[selectedNode.category],
                    }}
                  >
                    {selectedNode.category === "concept"
                      ? "概念"
                      : selectedNode.category === "formula"
                      ? "公式"
                      : selectedNode.category === "method"
                      ? "方法"
                      : "定理"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">掌握度：</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(selectedNode.mastery * 100)}%`,
                          backgroundColor: masteryColor(selectedNode.mastery),
                        }}
                      />
                    </div>
                    <span className="text-xs">{Math.round((selectedNode.mastery || 0) * 100)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">权重：</span>
                  <span>{selectedNode.weight.toFixed(1)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  关联错题 ({wrongQuestions.length})
                </h4>
                {wrongQuestions.length === 0 ? (
                  <p className="text-xs text-gray-400">暂无关联错题</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {wrongQuestions.map((wq) => (
                      <div
                        key={wq.id}
                        className="text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded"
                      >
                        <p className="line-clamp-2">{wq.question}</p>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] ${
                            wq.reviewed
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-500"
                          }`}
                        >
                          {wq.reviewed ? "已复习" : "待复习"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="font-medium text-gray-500">图例：</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>掌握度低</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>掌握度中</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>掌握度高</span>
            </div>
            <div className="flex items-center gap-1.5 ml-4">
              <span className="text-blue-500">●</span>
              <span>概念</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-500">●</span>
              <span>公式</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-500">●</span>
              <span>方法</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-500">●</span>
              <span>定理</span>
            </div>
            <span className="text-gray-400 ml-4">节点大小 = 权重</span>
            <span className="text-gray-400">拖拽节点移动 · 滚轮缩放</span>
          </div>
        </div>
      </div>
    </div>
  );
}
