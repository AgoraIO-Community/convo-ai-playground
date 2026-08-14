"use client";

import React, { useRef, useEffect } from "react";
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

  // Animation only on the icon (never on the tile - tile stays fixed). RTM: animate by state; RTC: no state so no animation.
  const getIconAnimationClass = () => {
    if (!isRtm) return ""; // RTC: no state updates — keep icon static (animates only when speaking in RTM)
    if (agentState === EAgentState.SPEAKING) return "animate-agent-icon-speaking";
    if (agentState === EAgentState.SILENT) return "opacity-60";
    return "animate-agent-icon-pulse";
  };

  // Get state-specific icon/content (RTM only; subtle calm animation)
  const getStateContent = () => {
    if (!isRtm) return null;
    const dotClass = "rounded-full bg-white/90 animate-agent-state-soft";
    const barClass = "rounded-full bg-white/90 animate-agent-state-soft";
    switch (agentState) {
      case EAgentState.LISTENING:
        return (
          <div className="flex items-center justify-center gap-1.5">
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "0ms" }} />
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "300ms" }} />
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "600ms" }} />
          </div>
        );
      case EAgentState.THINKING:
        return (
          <div className="flex items-center justify-center gap-1.5">
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "0ms" }} />
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "400ms" }} />
            <div className={`w-2 h-2 ${dotClass}`} style={{ animationDelay: "800ms" }} />
          </div>
        );
      case EAgentState.SPEAKING:
        return (
          <div className="flex items-center justify-center gap-1">
            <div className={`w-1 h-4 ${barClass}`} style={{ animationDelay: "0ms" }} />
            <div className={`w-1 h-6 ${barClass}`} style={{ animationDelay: "200ms" }} />
            <div className={`w-1 h-5 ${barClass}`} style={{ animationDelay: "400ms" }} />
            <div className={`w-1 h-4 ${barClass}`} style={{ animationDelay: "600ms" }} />
          </div>
        );
      default:
        return null;
    }
  };

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

  const hasVideo = Boolean(videoTrack);

  // v2.6: small live state pill — only shown when an avatar video occupies
  // the tile, because in that mode the bottom state label/animation is
  // hidden and we still want a glanceable signal. In the bot-icon view the
  // bottom label + animation already covers it, so we skip the pill there
  // to avoid duplicating the same indicator.
  const showLivePill =
    isRtm &&
    hasVideo &&
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
      {hasVideo && (
        <div
          ref={videoContainerRef}
          className="absolute inset-0 w-full h-full rounded-lg bg-black [&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full"
          aria-hidden
        />
      )}
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
      {/* Agent Avatar/Icon - shown when no video or as overlay */}
      <div className="relative flex flex-col items-center justify-center flex-1 p-4 z-[1]">
        {!hasVideo && (
          <>
            {/* Bot Icon - animation only here, tile stays fixed; ring + shadow for contrast */}
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm ring-2 ring-white/50 shadow-[0_4px_14px_rgba(0,0,0,0.25)] bg-white/25 dark:bg-white/20 ${getIconAnimationClass()}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-12 h-12 text-white"
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }}
              >
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-3 9a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1z" />
              </svg>
            </div>

            {/* State Animation (RTM only) */}
            {getStateContent()}

            {/* State Label: only in RTM (RTC has no status updates) */}
            {isRtm && (
              <div className="mt-2 text-sm font-medium opacity-90">{getStateLabel()}</div>
            )}
            {avatarWaiting && (
              <div className="mt-2 text-xs opacity-80">Waiting for avatar…</div>
            )}
          </>
        )}
      </div>

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
