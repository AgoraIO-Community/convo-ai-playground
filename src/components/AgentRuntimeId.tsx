"use client";

import { MdContentCopy } from "react-icons/md";
import { showToast } from "@/services/uiService";

interface AgentRuntimeIdProps {
  agentId?: string | null;
  compact?: boolean;
  className?: string;
}

const AgentRuntimeId: React.FC<AgentRuntimeIdProps> = ({
  agentId,
  compact = false,
  className = "",
}) => {
  if (!agentId) return null;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(agentId);
      showToast("Agent ID copied", "success");
    } catch {
      showToast("Unable to copy agent ID", "error");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      } ${className}`}
      aria-label="Copy agent ID"
      title={`Copy agent ID: ${agentId}`}
    >
      <span className="shrink-0 text-slate-400">Agent ID</span>
      <code className="min-w-0 max-w-52 truncate font-mono text-current sm:max-w-80">
        {agentId}
      </code>
      <MdContentCopy className="shrink-0 text-cyan-300" aria-hidden="true" />
    </button>
  );
};

export default AgentRuntimeId;
