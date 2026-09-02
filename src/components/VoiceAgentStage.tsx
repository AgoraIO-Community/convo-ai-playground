"use client";

import React from "react";
import AgentGlyph from "@/components/AgentGlyph";
import AgentRuntimeId from "@/components/AgentRuntimeId";
import { EAgentState } from "@/types/agora";

type AgentVisualState =
  | "ready"
  | "connected"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "silent";

interface VoiceAgentStageProps {
  agentId?: string | null;
  agentName: string;
  agentState: EAgentState;
  isAgentActive: boolean;
  transcriptionMode: "rtc" | "rtm";
  compact?: boolean;
  avatarWaiting?: boolean;
}

const stateLabels: Record<AgentVisualState, string> = {
  ready: "Ready",
  connected: "Connected",
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  silent: "Silent",
};

export function getAgentVisualState(
  isAgentActive: boolean,
  transcriptionMode: "rtc" | "rtm",
  agentState: EAgentState,
): AgentVisualState {
  if (!isAgentActive) return "ready";
  if (transcriptionMode === "rtc") return "connected";
  return agentState;
}

const VoiceAgentStage: React.FC<VoiceAgentStageProps> = ({
  agentId,
  agentName,
  agentState,
  isAgentActive,
  transcriptionMode,
  compact = false,
  avatarWaiting = false,
}) => {
  const visualState = getAgentVisualState(
    isAgentActive,
    transcriptionMode,
    agentState,
  );
  const label = stateLabels[visualState];

  return (
    <section
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/15 bg-[radial-gradient(circle_at_50%_42%,rgba(8,145,178,0.16),transparent_42%),linear-gradient(145deg,#07111f,#020617_72%)] text-white shadow-2xl ${
        compact ? "min-h-48 p-5" : "min-h-[22rem] p-8 sm:min-h-[30rem]"
      }`}
      data-testid="voice-agent-stage"
      aria-label={`${agentName} voice agent`}
    >
      <div
        className={`voice-agent-orb voice-agent-motion relative grid place-items-center rounded-full ${
          compact ? "h-28 w-28" : "h-48 w-48 sm:h-60 sm:w-60"
        }`}
        data-testid="voice-agent-orb"
        data-agent-visual-state={visualState}
        aria-hidden
      >
        <span className="voice-agent-ring voice-agent-ring-outer absolute inset-0 rounded-full" />
        <span className="voice-agent-ring voice-agent-ring-inner absolute inset-[14%] rounded-full" />
        <span className="voice-agent-orbit absolute inset-[4%] rounded-full" />
        <div className="relative grid h-[54%] w-[54%] place-items-center rounded-full border border-cyan-100/30 bg-slate-950/75 text-cyan-100 shadow-[0_0_48px_rgba(34,211,238,0.24),inset_0_0_30px_rgba(56,189,248,0.12)] backdrop-blur-xl">
          <AgentGlyph size={compact ? "stage" : "stage"} />
        </div>
      </div>

      <div className={compact ? "mt-4 text-center" : "mt-8 text-center"}>
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
          {agentName}
        </h2>
        <AgentRuntimeId
          agentId={agentId}
          compact={compact}
          className="mt-2"
        />
        <p
          className="mt-1 text-sm font-medium text-cyan-200/90"
          aria-live="polite"
        >
          {label}
        </p>
        {avatarWaiting && (
          <p className="mt-2 text-xs text-slate-400">Waiting for avatar video…</p>
        )}
      </div>
    </section>
  );
};

export default VoiceAgentStage;
