"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import AgentGlyph from "@/components/AgentGlyph";
import { EAgentState } from "@/types/agora";

interface TeacherAvatarPiPProps {
  active: boolean;
  agentId?: string | null;
  agentName: string;
  agentState: EAgentState;
  transcriptionMode: "rtc" | "rtm";
  videoTrack?: IRemoteVideoTrack | null;
  avatarExpected?: boolean;
  previewImageSrc?: string;
}

function stateLabel(agentState: EAgentState): string {
  switch (agentState) {
    case EAgentState.LISTENING:
      return "Listening";
    case EAgentState.THINKING:
      return "Thinking";
    case EAgentState.SPEAKING:
      return "Explaining";
    case EAgentState.SILENT:
      return "Paused";
    default:
      return "Ready";
  }
}

const TeacherAvatarPiP: React.FC<TeacherAvatarPiPProps> = ({
  active,
  agentId,
  agentName,
  agentState,
  transcriptionMode,
  videoTrack = null,
  avatarExpected = false,
  previewImageSrc,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!active || !container || !videoTrack) return;
    videoTrack.play(container);

    const fitVideo = (): void => {
      const video = container.querySelector("video");
      if (!video) return;
      video.style.objectFit = "cover";
      video.style.width = "100%";
      video.style.height = "100%";
    };
    fitVideo();
    const observer = new MutationObserver(fitVideo);
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      videoTrack.stop();
    };
  }, [active, videoTrack]);

  if (!videoTrack && avatarExpected) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.17),transparent_48%),#07111f] px-4 text-center text-white">
        <span className="mb-3 h-9 w-9 animate-pulse rounded-full border border-cyan-200/25 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.2)]" />
        <p className="text-sm font-semibold">Teacher connecting</p>
        <p className="mt-1 text-[11px] text-slate-400">Voice remains active</p>
      </div>
    );
  }

  if (!videoTrack && previewImageSrc) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
        <Image
          src={previewImageSrc}
          alt={`${agentName} AI teacher`}
          fill
          sizes="(max-width: 640px) 148px, 292px"
          className="object-cover"
          priority
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/5 to-slate-950/10" />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
          <div className="min-w-0 rounded-md bg-slate-950/70 px-2 py-1 backdrop-blur-md">
            <p className="truncate text-xs font-semibold">{agentName}</p>
            <p className="text-[10px] text-slate-300">AI teacher</p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-400/15 px-2 py-1 text-[10px] font-medium text-emerald-100 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" />
            {stateLabel(agentState)}
          </div>
        </div>
      </div>
    );
  }

  if (!videoTrack) {
    return (
      <div className="relative flex h-full w-full items-center gap-3 overflow-hidden bg-[radial-gradient(circle_at_28%_45%,rgba(34,211,238,0.2),transparent_38%),#07111f] px-3 text-white">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cyan-100/25 bg-slate-950/70 text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.2)]">
          <AgentGlyph size="control" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{agentName}</p>
          <p className="mt-0.5 text-[10px] font-medium text-cyan-200/80">
            {transcriptionMode === "rtm" ? stateLabel(agentState) : "Connected"}
          </p>
          {agentId && (
            <p className="mt-1 truncate text-[9px] text-slate-500">
              Voice teacher
            </p>
          )}
        </div>
      </div>
    );
  }

  const label =
    transcriptionMode === "rtm" ? stateLabel(agentState) : "Connected";

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
      <div
        ref={videoContainerRef}
        className="absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
        aria-label={`${agentName} avatar video`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/10" />
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
        <div className="min-w-0 rounded-md bg-slate-950/70 px-2 py-1 backdrop-blur-md">
          <p className="truncate text-xs font-semibold">{agentName}</p>
          <p className="text-[10px] text-slate-300">AI teacher</p>
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-400/15 px-2 py-1 text-[10px] font-medium text-emerald-100 backdrop-blur-md"
          aria-live="polite"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" />
          {label}
        </div>
      </div>
    </div>
  );
};

export default TeacherAvatarPiP;
