"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MdRefresh, MdExpandMore, MdExpandLess } from "react-icons/md";
import useAppStore from "@/store/useAppStore";
import { queryAgent } from "@/api/agentApi";
import type { AgentOperationalStatus } from "@/types/agora";

const POLL_INTERVAL_MS = 120_000;

const STATUS_COLORS: Record<
  AgentOperationalStatus,
  { dot: string; text: string }
> = {
  RUNNING: { dot: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  STARTING: {
    dot: "bg-yellow-500 animate-pulse",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  RECOVERING: {
    dot: "bg-yellow-500 animate-pulse",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  FAILED: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  STOPPED: { dot: "bg-red-400", text: "text-red-500 dark:text-red-400" },
  IDLE: { dot: "bg-gray-400", text: "text-gray-500 dark:text-gray-400" },
  STOPPING: {
    dot: "bg-gray-400 animate-pulse",
    text: "text-gray-500 dark:text-gray-400",
  },
};

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

/** Live agent signal derived from EAgentState (v2.6 clearer signals). */
type LiveSignal = "listening" | "thinking" | "speaking" | "idle";

const LIVE_SIGNAL_STYLES: Record<
  LiveSignal,
  { dot: string; text: string; label: string }
> = {
  listening: {
    dot: "bg-green-500 animate-pulse",
    text: "text-green-700 dark:text-green-300",
    label: "Listening",
  },
  thinking: {
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700 dark:text-amber-300",
    label: "Thinking",
  },
  speaking: {
    dot: "bg-blue-500 animate-pulse",
    text: "text-blue-700 dark:text-blue-300",
    label: "Speaking",
  },
  idle: {
    dot: "bg-gray-300 dark:bg-gray-600",
    text: "text-gray-500 dark:text-gray-400",
    label: "Idle",
  },
};

const AgentStatusBadge: React.FC = () => {
  const agentId = useAppStore((state) => state.agentId);
  const agentQueryStatus = useAppStore((state) => state.agentQueryStatus);
  const setAgentQueryStatus = useAppStore((state) => state.setAgentQueryStatus);
  const agentListening = useAppStore((state) => state.agentListening);
  const agentThinking = useAppStore((state) => state.agentThinking);
  const agentSpeaking = useAppStore((state) => state.agentSpeaking);
  const isAgentActive = useAppStore((state) => state.isAgentActive);

  const [expanded, setExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    if (!agentId) return;
    try {
      const status = await queryAgent(agentId);
      setAgentQueryStatus(status);
      setLastRefreshedAt(new Date());
    } catch (error) {
      console.error("[AgentStatusBadge] Query failed:", error);
    }
  }, [agentId, setAgentQueryStatus]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStatus();
    setIsRefreshing(false);
    // Reset the interval timer after manual refresh
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
  }, [fetchStatus]);

  // Start polling when agentId is set
  useEffect(() => {
    if (!agentId) return;

    // Fetch immediately on mount
    fetchStatus();

    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [agentId, fetchStatus]);

  // Close expanded view when clicking outside
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  const status = agentQueryStatus?.status ?? "STARTING";
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.IDLE;

  const liveSignal: LiveSignal = agentSpeaking
    ? "speaking"
    : agentThinking
    ? "thinking"
    : agentListening
    ? "listening"
    : "idle";
  const showLiveSignal = isAgentActive && status === "RUNNING";
  const liveStyle = LIVE_SIGNAL_STYLES[liveSignal];

  return (
    <div ref={badgeRef} className="relative">
      <div className="flex items-center gap-1.5">
        {/* Collapsed operational status badge.
            Live "listening / thinking / speaking" signal lives on the
            AgentTile (and inside this badge's expanded popover) to avoid
            duplicating the same indicator twice in the bottom bar. */}
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-xs"
          title="Click for agent status details"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
          <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Agent Status:
          </span>
          <span className={`font-semibold whitespace-nowrap ${colors.text}`}>
            {status}
          </span>
          {expanded ? (
            <MdExpandLess className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          ) : (
            <MdExpandMore className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
      </div>

      {/* Expanded popover */}
      {expanded && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Agent Details
            </h4>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              title="Refresh now"
            >
              <MdRefresh
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className={`font-semibold ${colors.text}`}>{status}</span>
            </div>

            {showLiveSignal && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">
                  Live signal
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${liveStyle.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${liveStyle.dot}`} />
                  {liveStyle.label}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Agent ID</span>
              <span
                className="text-gray-700 dark:text-gray-300 font-mono truncate max-w-[140px]"
                title={agentQueryStatus?.agent_id ?? agentId ?? ""}
              >
                {agentQueryStatus?.agent_id ?? agentId ?? "—"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Started</span>
              <span className="text-gray-700 dark:text-gray-300">
                {agentQueryStatus
                  ? formatTimestamp(agentQueryStatus.start_ts)
                  : "—"}
              </span>
            </div>

            {agentQueryStatus?.stop_ts ? (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Stopped
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {formatTimestamp(agentQueryStatus.stop_ts)}
                </span>
              </div>
            ) : null}

            {agentQueryStatus?.message && (
              <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 block mb-0.5">
                  Message
                </span>
                <span className="text-gray-700 dark:text-gray-300 break-words">
                  {agentQueryStatus.message}
                </span>
              </div>
            )}
          </div>

          {lastRefreshedAt && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
              Last refreshed: {lastRefreshedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentStatusBadge;
