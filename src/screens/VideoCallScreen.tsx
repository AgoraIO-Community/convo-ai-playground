"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdChat, MdTimer } from "react-icons/md";
import AgentTile from "@/components/AgentTile";
import BottomSheet from "@/components/common/BottomSheet";
import Controls from "@/components/Controls";
import TranscriptSidePanel from "@/components/TranscriptSidePanel";
import VideoTile from "@/components/VideoTile";
import { useAgora } from "@/hooks/useAgora";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import useAppStore from "@/store/useAppStore";

const SESSION_DURATION_MS = 15 * 60 * 1000;

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const VideoCallScreen: React.FC = () => {
  const router = useRouter();
  const localUsername = useAppStore((state) => state.localUsername);
  const localUID = useAppStore((state) => state.localUID);
  const channelId = useAppStore((state) => state.channelId);
  const audioMuted = useAppStore((state) => state.audioMuted);
  const videoMuted = useAppStore((state) => state.videoMuted);
  const isAgentActive = useAppStore((state) => state.isAgentActive);
  const agentState = useAppStore((state) => state.agentState);
  const agentRtcUid = useAppStore((state) => state.agentRtcUid);
  const agentAvatarRtcUid = useAppStore((state) => state.agentAvatarRtcUid);
  const agentSettings = useAppStore((state) => state.agentSettings);
  const transcriptionMode = useAppStore((state) => state.transcriptionMode);
  const sessionStartTime = useAppStore((state) => state.sessionStartTime);
  const [remainingMs, setRemainingMs] = useState(SESSION_DURATION_MS);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const isEndingRef = useRef(false);

  const {
    leaveCall,
    localTracks,
    avatarVideoTrack,
    rtcClient,
    rtmClient,
  } = useAgora();
  const { sendChatMessage } = useConversationalAI({
    rtcClient,
    rtmClient,
    channelId,
    isAgentActive,
    transcriptionMode,
    agentRtcUid,
  });

  const endCall = useCallback(
    async (reason: "ended" | "expired"): Promise<void> => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      try {
        await leaveCall();
        router.replace(`/call-ended?reason=${reason}`);
      } catch (error) {
        isEndingRef.current = false;
        throw error;
      }
    },
    [leaveCall, router],
  );

  const handleEndCall = useCallback(
    async (): Promise<void> => endCall("ended"),
    [endCall],
  );

  useEffect(() => {
    if (sessionStartTime == null) return;
    const updateRemaining = (): void => {
      setRemainingMs(
        Math.max(0, SESSION_DURATION_MS - (Date.now() - sessionStartTime)),
      );
    };
    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionStartTime]);

  useEffect(() => {
    if (sessionStartTime != null && remainingMs <= 0) {
      void endCall("expired");
    }
  }, [endCall, remainingMs, sessionStartTime]);

  const canSendChat = transcriptionMode === "rtm" && Boolean(agentRtcUid);
  const transcript = (
    <TranscriptSidePanel
      isOpen
      onClose={() => setIsTranscriptOpen(false)}
      embedded
      onSendMessage={canSendChat ? sendChatMessage : undefined}
    />
  );

  return (
    <div className="flex h-screen-dvh flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">
            Private agent call
          </p>
          <p className="text-xs text-slate-400">
            {transcriptionMode === "rtm"
              ? "Connected with Agora RTC + RTM"
              : "Connected with Agora RTC"}
          </p>
        </div>

        {isAgentActive && (
          <span className="hidden rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 sm:inline-flex">
            {transcriptionMode.toUpperCase()} live
          </span>
        )}
        <span
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium tabular-nums"
          title="Time remaining in this call"
        >
          <MdTimer className="text-cyan-300" aria-hidden />
          {formatRemaining(remainingMs)}
        </span>
        <button
          type="button"
          onClick={() => setIsTranscriptOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white md:hidden"
          aria-label="Open transcript and chat"
          title="Open transcript and chat"
        >
          <MdChat />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[350px] shrink-0 border-r border-white/10 bg-slate-900 md:flex md:flex-col">
          {transcript}
        </aside>

        <main className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-3 sm:p-5">
          <div
            className={`grid w-full max-w-6xl gap-3 sm:gap-5 ${
              isAgentActive ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
            }`}
          >
            <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <VideoTile
                uid={localUID ?? "local"}
                name={localUsername || "You"}
                isLocal
                track={localTracks.videoTrack}
                micMuted={audioMuted}
                videoMuted={videoMuted}
              />
            </div>

            {isAgentActive && agentRtcUid && (
              <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-cyan-300/20 shadow-2xl">
                <AgentTile
                  agentUid={agentAvatarRtcUid || agentRtcUid}
                  agentState={agentState}
                  agentName={agentSettings?.name || "AI Agent"}
                  transcriptionMode={transcriptionMode}
                  videoTrack={avatarVideoTrack}
                  avatarWaiting={
                    Boolean(agentSettings?.avatar?.enable) && !avatarVideoTrack
                  }
                />
              </div>
            )}
          </div>
        </main>
      </div>

      <Controls onEndCall={handleEndCall} />

      <BottomSheet
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        title="Transcript & chat"
        snapPoints={[0.72, 0.94]}
        contentClassName="p-0"
      >
        <div className="h-full min-h-0 bg-slate-900">{transcript}</div>
      </BottomSheet>
    </div>
  );
};

export default VideoCallScreen;
