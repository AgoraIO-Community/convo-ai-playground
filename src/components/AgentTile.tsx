"use client";

import React, { useRef, useEffect } from "react";
import VoiceAgentStage from "@/components/VoiceAgentStage";
import { EAgentState } from "@/types/agora";
import type { IRemoteVideoTrack } from "agora-rtc-sdk-ng";

interface AgentTileProps {
  agentUid: string;
  agentState: EAgentState;
  agentName?: string;
  /** When "rtc", status label (e.g. Idle) is hidden since RTC has no state updates. When "rtm", show speaking/listening etc. with animation. */
  transcriptionMode?: "rtc" | "rtm";
  /** When provided (e.g. avatar video from remote user 999999), render the video in the tile instead of only the static icon. */
  videoTrack?: IRemoteVideoTrack | null;
  /** When true and no videoTrack, show a short "Waiting for avatar…" hint (avatar enabled but HeyGen not connected yet). */
  avatarWaiting?: boolean;
}

const AgentTile: React.FC<AgentTileProps> = ({
  agentUid,
  agentState,
  agentName = "AI Agent",
  transcriptionMode = "rtm",
  videoTrack = null,
  avatarWaiting = false,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isRtm = transcriptionMode === "rtm";

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container || !videoTrack) return;
    videoTrack.play(container);

    const setContain = (el: Element) => {
      (el as HTMLVideoElement).style.objectFit = "contain";
    };
    const video = container.querySelector("video");
    if (video) {
      setContain(video);
    }
    // Agora may inject <video> async; observe so we override object-fit when it appears
    const observer = new MutationObserver(() => {
      const v = container.querySelector("video");
      if (v) setContain(v);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      videoTrack.stop();
    };
  }, [videoTrack]);

  if (!videoTrack) {
    return (
      <VoiceAgentStage
        compact
        agentName={agentName}
        agentState={agentState}
        isAgentActive
        transcriptionMode={transcriptionMode}
        avatarWaiting={avatarWaiting}
      />
    );
  }

  // Get state label
  const getStateLabel = () => {
    switch (agentState) {
      case EAgentState.IDLE:
        return "Idle";
      case EAgentState.LISTENING:
        return "Listening";
      case EAgentState.THINKING:
        return "Thinking";
      case EAgentState.SPEAKING:
        return "Speaking";
      case EAgentState.SILENT:
        return "Silent";
      default:
        return "";
    }
  };

  // v2.6: small live state pill — only shown when an avatar video occupies
  // the tile, because in that mode the bottom state label/animation is
  // hidden and we still want a glanceable signal. In the bot-icon view the
  // bottom label + animation already covers it, so we skip the pill there
  // to avoid duplicating the same indicator.
  const showLivePill =
    isRtm &&
    (agentState === EAgentState.LISTENING ||
      agentState === EAgentState.THINKING ||
      agentState === EAgentState.SPEAKING);
  const livePillClass =
    agentState === EAgentState.SPEAKING
      ? "bg-blue-500/90 text-white"
      : agentState === EAgentState.THINKING
      ? "bg-amber-500/90 text-white"
      : "bg-green-500/90 text-white";

  return (
    <div
      id={`agent-${agentUid}`}
      className="relative bg-agora-accent-blue rounded-lg overflow-hidden h-full w-full flex flex-col items-center justify-center text-white agent-tile-vintage"
    >
      {/* Avatar video when available (e.g. HeyGen avatar stream) */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 w-full h-full rounded-lg bg-black [&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full"
        aria-hidden
      />
      {/* Subtle dark overlay for vintage / less bright */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/25 via-transparent to-black/5 pointer-events-none" aria-hidden />

      {/* v2.6 live state pill overlay (top-right) */}
      {showLivePill && (
        <div
          className={`absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shadow ${livePillClass}`}
          aria-live="polite"
          title="Live agent state (v2.6 clearer signals)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
          {getStateLabel()}
        </div>
      )}
      {/* Agent Name - width fits text only (not full width), no mic icon */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex justify-start">
        <div className="w-fit max-w-full bg-gray-900/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 rounded-md text-sm shadow-md">
          <span className="font-medium truncate block">{agentName}</span>
        </div>
      </div>
    </div>
  );
};

export default AgentTile;
