import { AiWorkspaceRoute } from "@/components/ai-workspace-route";

/**
 * 保留旧链接兼容性：AI 不再是脱离学习场景的独立页面，
 * 此入口会打开当前外壳中的 AI 工作区。
 */
export default function ChatPage() {
  return <AiWorkspaceRoute />;
}
