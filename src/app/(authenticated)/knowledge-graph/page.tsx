"use client";

import dynamic from "next/dynamic";

// D3 is huge (~4MB), only load it client-side so it doesn't bloat the SSR bundle
const KnowledgeGraphClient = dynamic(
  () => import("./knowledge-graph-client"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <span className="text-gray-400">加载知识图谱...</span>
    </div>
  )}
);

export default function KnowledgeGraphPage() {
  return <KnowledgeGraphClient />;
}
