"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import useAppStore from "@/store/useAppStore";
import VideoTile from "@/components/VideoTile";
import AgentTile from "@/components/AgentTile";
import Controls from "@/components/Controls";
import ParticipantListItem from "@/components/ParticipantListItem";
import Whiteboard from "@/components/Whiteboard";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import MeetingAuthHeader from "@/components/MeetingAuthHeader";
import TranscriptSidePanel from "@/components/TranscriptSidePanel";
import MobileTopBar from "@/components/MobileTopBar";
import BottomSheet from "@/components/common/BottomSheet";
import { useAgora } from "@/hooks/useAgora";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import { useIsMobile, useIsTablet } from "@/hooks/useMediaQuery";
import type { IAgoraRTCRemoteUser, IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import {
  MdWbSunny,
  MdDarkMode,
  MdTimer,
  MdHelpOutline,
  MdClose,
} from "react-icons/md";
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/FeatureTour";

const SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Dedicated tile that only shows avatar video + name overlay (no icon/state toggle). */
function AvatarVideoTile({
  videoTrack,
  agentName,
}: {
  videoTrack: IRemoteVideoTrack;
  agentName: string;
}) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container || !videoTrack) return;
    videoTrack.play(container);
    const setContain = (el: Element) => {
      (el as HTMLVideoElement).style.objectFit = "contain";
    };
    const video = container.querySelector("video");
    if (video) setContain(video);
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
  return (
    <div className="relative bg-agora-accent-blue rounded-lg overflow-hidden h-full w-full flex flex-col items-center justify-center text-white agent-tile-vintage">
      <div
        ref={videoContainerRef}
        className="absolute inset-0 w-full h-full rounded-lg bg-black [&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full"
        aria-hidden
      />
      <div
        className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/25 via-transparent to-black/5 pointer-events-none"
        aria-hidden
      />
      <div className="absolute bottom-2 left-2 right-2 z-10 flex justify-start">
        <div className="w-fit max-w-full bg-gray-900/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 rounded-md text-sm shadow-md">
          <span className="font-medium truncate block">{agentName}</span>
        </div>
      </div>
    </div>
  );
}

const VideoCallScreen: React.FC = () => {
  const router = useRouter();

  const {
    localUsername,
    localUID,
    meetingName,
    channelId,
    audioMuted,
    videoMuted,
    remoteParticipants,
    theme,
    toggleTheme,
    isWhiteboardActive,
    whiteboardRoomToken,
    whiteboardRoomUuid,
    isHost,
    pendingUnmuteRequest,
    callActive,
    isAgentActive,
    isAgentLoading,
    agentState,
    agentRtcUid,
    agentAvatarRtcUid,
    agentSettings,
    transcriptionMode,
    sessionStartTime,
    logout,
    activeScreenShareUid,
    screenShareUid,
    isScreenSharing,
    localScreenVideoTrack,
    remoteScreenVideoTrack,
    screenSharerName,
  } = useAppStore();

  const [remainingMs, setRemainingMs] = useState<number>(SESSION_DURATION_MS);
  const [isParticipantPanelOpen, setIsParticipantPanelOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [isTranscriptSheetOpen, setIsTranscriptSheetOpen] = useState(false);
  const [isParticipantSheetOpen, setIsParticipantSheetOpen] = useState(false);

  useEffect(() => {
    if (!callActive) {
      router.push("/");
    }
  }, [callActive, router]);

  // Session timer: countdown and auto-logout at 0
  useEffect(() => {
    if (!sessionStartTime) return;
    const update = () => {
      const elapsed = Date.now() - sessionStartTime;
      const remaining = SESSION_DURATION_MS - elapsed;
      setRemainingMs(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const { leaveCall } = useAgora();

  const handleSessionExpired = useCallback(async () => {
    await leaveCall(); // stops agent, clears uploads, runs callEnd
    logout();
    void signOut({ callbackUrl: "/" });
  }, [leaveCall, logout]);

  useEffect(() => {
    if (remainingMs <= 0 && sessionStartTime != null) {
      handleSessionExpired();
    }
  }, [remainingMs, sessionStartTime, handleSessionExpired]);

  const participantCount =
    1 +
    Object.keys(remoteParticipants).filter(
      (uid) =>
        uid !== String(localUID) &&
        (screenShareUid == null || uid !== screenShareUid),
    ).length;

  const {
    localTracks,
    remoteUsers,
    avatarVideoTrack: hookAvatarVideoTrack,
    sendHostControlRequest,
    acceptUnmuteRequest,
    declineUnmuteRequest,
    rtcClient,
    rtmClient,
  } = useAgora();

  const useSidebarLayout = isWhiteboardActive || !!activeScreenShareUid;

  const tour = useTour();

  // Initialize conversational AI hook for transcript handling
  const { sendChatMessage } = useConversationalAI({
    rtcClient,
    rtmClient,
    channelId,
    isAgentActive,
    transcriptionMode,
    agentRtcUid,
  });

  const handleMuteAudio = useCallback(
    (uid: string) => {
      sendHostControlRequest(uid, "mute", "audio");
    },
    [sendHostControlRequest],
  );

  const handleMuteVideo = useCallback(
    (uid: string) => {
      sendHostControlRequest(uid, "mute", "video");
    },
    [sendHostControlRequest],
  );

  const handleUnmuteAudio = useCallback(
    (uid: string) => {
      sendHostControlRequest(uid, "unmute", "audio");
    },
    [sendHostControlRequest],
  );

  const handleUnmuteVideo = useCallback(
    (uid: string) => {
      sendHostControlRequest(uid, "unmute", "video");
    },
    [sendHostControlRequest],
  );

  return (
    <div className="flex flex-col h-screen-dvh bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Top Bar: mobile gets compact bar; desktop/tablet get full 3-col header */}
      {isMobile ? (
        <MobileTopBar
          meetingName={meetingName}
          channelId={channelId}
          remainingLabel={
            sessionStartTime != null ? formatRemaining(remainingMs) : null
          }
          isAgentActive={isAgentActive}
          transcriptionMode={transcriptionMode}
          onStartTour={tour.startTour}
          onOpenTranscript={() => setIsTranscriptSheetOpen(true)}
        />
      ) : (
      <div className="grid grid-cols-3 items-center gap-3 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 text-lg shadow-md transition-colors duration-300">
        <div className="min-w-0 flex justify-start">
          <span
            data-tour="tour-meeting-name"
            className="font-bold text-xl font-syne truncate"
          >
            Meeting: {meetingName || channelId}
          </span>
        </div>
        <div className="min-w-0 flex justify-center text-center px-2">
          <span
            className="font-semibold text-base sm:text-lg text-[var(--agora-accent-blue)] truncate max-w-full"
            title="Build4भारत Hackathon 9.0"
          >
            Conversational Agent
          </span>
        </div>
        <div className="flex items-center gap-3 justify-end min-w-0">
          {/* Transmission Badge - shown when agent is active */}
          {isAgentActive && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                transcriptionMode === "rtm"
                  ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
              }`}
            >
              Transmission: {transcriptionMode.toUpperCase()}
            </span>
          )}

          {sessionStartTime != null && (
            <span
              data-tour="tour-session-timer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium tabular-nums"
              title="Session ends in 15 minutes; you will be logged out when time runs out."
            >
              <MdTimer
                className="w-4 h-4 text-[var(--agora-accent-blue)] shrink-0"
                aria-hidden
              />
              {formatRemaining(remainingMs)}
            </span>
          )}

          <MeetingAuthHeader inline />

          <button
            onClick={tour.startTour}
            className="p-2 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--agora-accent-blue)] transition-all text-gray-800 dark:text-white"
            title="Take a tour of the controls"
          >
            <MdHelpOutline size={22} />
          </button>

          <button
            data-tour="tour-theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--agora-accent-blue)] transition-all text-gray-800 dark:text-white"
            title={
              theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
          >
            {theme === "dark" ? (
              <MdWbSunny size={24} className="text-yellow-400" />
            ) : (
              <MdDarkMode size={24} className="text-gray-700" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: hidden on mobile (uses sheets). Tablet: 280px. Desktop: 350px. */}
        {!useSidebarLayout && !isMobile && (
          <div
            className="shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden hidden sm:flex flex-col shadow-inner transition-colors duration-300"
            style={{
              width: isTablet ? 280 : 350,
              minWidth: isTablet ? 280 : 350,
              maxWidth: isTablet ? 280 : 350,
            }}
          >
            {isParticipantPanelOpen ? (
              <>
                <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900 w-full min-w-0">
                  <strong className="text-sm text-gray-900 dark:text-white truncate">
                    Participants: {participantCount}
                  </strong>
                  <button
                    onClick={() => setIsParticipantPanelOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors shrink-0"
                    title="Close and show Live Transcript"
                  >
                    <MdClose className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 min-w-0 w-full bg-gray-50 dark:bg-gray-900/50">
                  <ParticipantListItem
                    name={localUsername}
                    micMuted={audioMuted}
                    videoMuted={videoMuted}
                    isLocal={true}
                  />
                  <hr className="my-3 border-gray-200 dark:border-gray-600" />
                  {Object.entries(remoteParticipants)
                    .filter(([uid]) => uid !== String(localUID))
                    .map(([uid, participant]) => (
                      <ParticipantListItem
                        key={uid}
                        uid={uid}
                        name={participant.name}
                        micMuted={participant.micMuted}
                        videoMuted={participant.videoMuted}
                        isLocal={false}
                        isHost={isHost}
                        onMuteAudio={handleMuteAudio}
                        onMuteVideo={handleMuteVideo}
                        onUnmuteAudio={handleUnmuteAudio}
                        onUnmuteVideo={handleUnmuteVideo}
                      />
                    ))}
                </div>
              </>
            ) : (
              <TranscriptSidePanel
                isOpen={true}
                onClose={() => {}}
                embedded={true}
                onSendMessage={
                  transcriptionMode === "rtm" && agentRtcUid
                    ? sendChatMessage
                    : undefined
                }
              />
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
          {activeScreenShareUid ? (
            <div className="h-full w-full flex items-center justify-center p-4 bg-black/5 dark:bg-black/20">
              {isScreenSharing && localScreenVideoTrack ? (
                // Local user is sharing - show their own screen
                <div className="w-full h-full max-w-full flex items-center justify-center [&_video]:object-contain">
                  <VideoTile
                    key="local-screen"
                    uid={activeScreenShareUid}
                    name={`${screenSharerName || localUsername}'s Screen`}
                    isLocal={true}
                    track={localScreenVideoTrack}
                    micMuted={true}
                    videoMuted={false}
                  />
                </div>
              ) : remoteScreenVideoTrack ? (
                // Remote user is sharing - show their screen from the dedicated track
                <div className="w-full h-full max-w-full flex items-center justify-center [&_video]:object-contain">
                  <VideoTile
                    key={`screen-${activeScreenShareUid}`}
                    uid={activeScreenShareUid}
                    name={`${screenSharerName || "Someone"}'s Screen`}
                    isLocal={false}
                    track={remoteScreenVideoTrack}
                    micMuted={true}
                    videoMuted={false}
                  />
                </div>
              ) : (
                // Waiting for the screen share stream to arrive
                <div className="text-gray-500 dark:text-gray-400">
                  Waiting for screen share…
                </div>
              )}
            </div>
          ) : isWhiteboardActive ? (
            <div className="h-full w-full p-2">
              <Whiteboard
                roomUuid={whiteboardRoomUuid}
                roomToken={whiteboardRoomToken}
                uid={`user-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              {(() => {
                const allTiles = [];

                if (localUID) {
                  allTiles.push(
                    <VideoTile
                      key={localUID}
                      uid={localUID}
                      name={localUsername}
                      isLocal={true}
                      track={videoMuted ? null : localTracks.videoTrack}
                      micMuted={audioMuted}
                      videoMuted={!localTracks.videoTrack || videoMuted}
                    />,
                  );
                }

                // Avatar video track comes directly from useAgora (tracked independently, like the sample)
                // No need to look it up in remoteUsers - it's set directly from user-published events

                // Exclude agent, avatar, and screen-share UIDs from "other" tiles
                const agentAndAvatarUids = new Set<string>();
                if (agentRtcUid) agentAndAvatarUids.add(agentRtcUid);
                if (agentAvatarRtcUid)
                  agentAndAvatarUids.add(agentAvatarRtcUid);
                if (screenShareUid) agentAndAvatarUids.add(screenShareUid);
                remoteUsers.forEach((user: IAgoraRTCRemoteUser) => {
                  const uidStr = String(user.uid);
                  if (agentAndAvatarUids.has(uidStr)) return;
                  const participantInfo = remoteParticipants[uidStr];
                  allTiles.push(
                    <VideoTile
                      key={user.uid}
                      uid={user.uid}
                      name={participantInfo?.name || `User ${user.uid}`}
                      isLocal={false}
                      track={user.videoTrack || null}
                      micMuted={participantInfo?.micMuted || true}
                      videoMuted={participantInfo?.videoMuted || true}
                    />,
                  );
                });

                // Agent connecting placeholder — shown between Start Agent click and agent join
                if (isAgentLoading && !isAgentActive) {
                  allTiles.push(
                    <div
                      key="agent-connecting"
                      className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-[var(--agora-accent-blue)]/20 to-gray-800/60 dark:from-[var(--agora-accent-blue)]/30 dark:to-gray-900 border border-[var(--agora-accent-blue)]/40 flex flex-col items-center justify-center gap-3"
                      role="status"
                      aria-live="polite"
                      aria-label="AI agent is connecting"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-skeleton-shimmer"
                      />
                      <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[var(--agora-accent-blue)]/20 ring-2 ring-[var(--agora-accent-blue)]/40">
                        <span className="absolute inset-0 rounded-full bg-[var(--agora-accent-blue)]/30 animate-ping" />
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-8 h-8 text-[var(--agora-accent-blue)] animate-pulse"
                        >
                          <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-3 9a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1z" />
                        </svg>
                      </div>
                      <div className="relative text-center">
                        <div className="text-sm font-semibold text-white">
                          {agentSettings?.name || "AI Agent"}
                        </div>
                        <div className="text-xs text-gray-200 mt-0.5">
                          Connecting…
                        </div>
                      </div>
                    </div>,
                  );
                }

                // Agent: separate render paths — dedicated avatar video tile vs normal/waiting AgentTile
                if (isAgentActive && agentRtcUid) {
                  if (agentAvatarRtcUid && hookAvatarVideoTrack) {
                    allTiles.push(
                      <AvatarVideoTile
                        key={`agent-avatar-${agentRtcUid}`}
                        videoTrack={hookAvatarVideoTrack}
                        agentName={agentSettings?.name || "AI Agent"}
                      />,
                    );
                  } else {
                    allTiles.push(
                      <AgentTile
                        key={`agent-${agentRtcUid}`}
                        agentUid={agentRtcUid}
                        agentState={agentState}
                        agentName={agentSettings?.name || "AI Agent"}
                        transcriptionMode={transcriptionMode}
                        videoTrack={null}
                        avatarWaiting={
                          !!(agentAvatarRtcUid && !hookAvatarVideoTrack)
                        }
                      />,
                    );
                  }
                }

                const count = allTiles.length;
                let gridClass = "";
                let itemClass = "";

                if (isMobile) {
                  if (count === 1) {
                    gridClass = "flex justify-center items-center w-full h-full";
                    itemClass = "w-full max-w-md aspect-video";
                  } else if (count <= 4) {
                    gridClass = "grid grid-cols-1 gap-3 w-full overflow-y-auto max-h-full";
                    itemClass = "aspect-video min-h-0";
                  } else {
                    gridClass = "grid grid-cols-2 gap-2 w-full overflow-y-auto max-h-full";
                    itemClass = "aspect-video min-h-0";
                  }
                } else if (count === 1) {
                  gridClass = "flex justify-center items-center w-full h-full";
                  itemClass = "w-[70%] max-w-4xl aspect-video";
                } else if (count === 2) {
                  gridClass = "grid grid-cols-2 gap-4 w-full max-w-5xl";
                  itemClass = "aspect-video";
                } else if (count === 3) {
                  return (
                    <div className="flex flex-col gap-4 w-full max-w-5xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="aspect-video">{allTiles[0]}</div>
                        <div className="aspect-video">{allTiles[1]}</div>
                      </div>
                      <div className="flex justify-center">
                        <div className="aspect-video w-1/2">{allTiles[2]}</div>
                      </div>
                    </div>
                  );
                } else if (count === 4) {
                  gridClass = "grid grid-cols-2 gap-4 w-full max-w-5xl";
                  itemClass = "aspect-video";
                } else if (count <= 6) {
                  gridClass = "grid grid-cols-3 gap-3 w-full max-w-6xl";
                  itemClass = "aspect-video";
                } else {
                  gridClass = "grid grid-cols-4 gap-2 w-full max-w-7xl";
                  itemClass = "aspect-video";
                }

                return (
                  <div className={gridClass}>
                    {allTiles.map((tile, index) => (
                      <div key={index} className={itemClass}>
                        {tile}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {useSidebarLayout && (
          <div className="w-64 bg-gray-200 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 overflow-y-auto hidden sm:flex flex-col shadow-inner transition-colors duration-300">
            <div className="p-3 border-b border-gray-300 dark:border-gray-700">
              <strong className="text-sm text-gray-900 dark:text-white">
                Participants ({participantCount})
              </strong>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {localUID && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <VideoTile
                    key={localUID}
                    uid={localUID}
                    name={localUsername}
                    isLocal={true}
                    track={videoMuted ? null : localTracks.videoTrack}
                    micMuted={audioMuted}
                    videoMuted={!localTracks.videoTrack || videoMuted}
                  />
                </div>
              )}

              {remoteUsers
                .filter((user) => {
                  const uidStr = String(user.uid);
                  if (activeScreenShareUid && uidStr === activeScreenShareUid)
                    return false;
                  if (screenShareUid && uidStr === screenShareUid) return false;
                  if (agentRtcUid && uidStr === agentRtcUid) return false;
                  if (agentAvatarRtcUid && uidStr === agentAvatarRtcUid)
                    return false;
                  if (isAgentActive && agentAvatarRtcUid && user.videoTrack) {
                    const dedicated = remoteUsers.find(
                      (u) => String(u.uid) === agentAvatarRtcUid,
                    );
                    if (!dedicated?.videoTrack) {
                      const fallback = remoteUsers.find((u) => u.videoTrack);
                      if (fallback && String(fallback.uid) === uidStr)
                        return false;
                    }
                  }
                  return true;
                })
                .map((user: IAgoraRTCRemoteUser) => {
                  const participantInfo = remoteParticipants[String(user.uid)];
                  return (
                    <div
                      key={user.uid}
                      className="aspect-video rounded-lg overflow-hidden"
                    >
                      <VideoTile
                        uid={user.uid}
                        name={participantInfo?.name || `User ${user.uid}`}
                        isLocal={false}
                        track={user.videoTrack || null}
                        micMuted={participantInfo?.micMuted || true}
                        videoMuted={participantInfo?.videoMuted || true}
                      />
                    </div>
                  );
                })}

              {/* Agent connecting placeholder in sidebar */}
              {isAgentLoading && !isAgentActive && (
                <div
                  className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-[var(--agora-accent-blue)]/20 to-gray-800/60 border border-[var(--agora-accent-blue)]/40 flex flex-col items-center justify-center gap-2"
                  role="status"
                  aria-live="polite"
                  aria-label="AI agent is connecting"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-skeleton-shimmer"
                  />
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[var(--agora-accent-blue)]/20 ring-2 ring-[var(--agora-accent-blue)]/40">
                    <span className="absolute inset-0 rounded-full bg-[var(--agora-accent-blue)]/30 animate-ping" />
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-[var(--agora-accent-blue)]"
                    >
                      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-3 9a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1z" />
                    </svg>
                  </div>
                  <div className="relative text-xs text-white font-medium">
                    Connecting…
                  </div>
                </div>
              )}

              {/* Agent / avatar tile(s) in sidebar when whiteboard is open */}
              {isAgentActive && agentRtcUid && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  {agentAvatarRtcUid && hookAvatarVideoTrack ? (
                    <AvatarVideoTile
                      videoTrack={hookAvatarVideoTrack}
                      agentName={agentSettings?.name || "AI Agent"}
                    />
                  ) : (
                    <AgentTile
                      agentUid={agentRtcUid}
                      agentState={agentState}
                      agentName={agentSettings?.name || "AI Agent"}
                      transcriptionMode={transcriptionMode}
                      videoTrack={null}
                      avatarWaiting={
                        !!(agentAvatarRtcUid && !hookAvatarVideoTrack)
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Controls
        sendChatMessage={sendChatMessage}
        onToggleParticipantPanel={
          isMobile
            ? () => setIsParticipantSheetOpen(true)
            : !useSidebarLayout
              ? () => setIsParticipantPanelOpen((prev) => !prev)
              : undefined
        }
        isParticipantPanelOpen={
          isMobile ? isParticipantSheetOpen : isParticipantPanelOpen
        }
      />

      {/* Mobile: transcript bottom sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={isTranscriptSheetOpen}
          onClose={() => setIsTranscriptSheetOpen(false)}
          snapPoints={[0.55, 0.92]}
          ariaLabelledBy="transcript-sheet-title"
        >
          <div className="h-full">
            <TranscriptSidePanel
              isOpen={true}
              onClose={() => setIsTranscriptSheetOpen(false)}
              embedded={true}
              onSendMessage={
                transcriptionMode === "rtm" && agentRtcUid
                  ? sendChatMessage
                  : undefined
              }
            />
          </div>
        </BottomSheet>
      )}

      {/* Mobile: participants bottom sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={isParticipantSheetOpen}
          onClose={() => setIsParticipantSheetOpen(false)}
          title={`Participants: ${participantCount}`}
          snapPoints={[0.55, 0.92]}
          ariaLabelledBy="participants-sheet-title"
        >
          <div className="px-3 py-3 bg-gray-50 dark:bg-gray-900/50">
            <ParticipantListItem
              name={localUsername}
              micMuted={audioMuted}
              videoMuted={videoMuted}
              isLocal={true}
            />
            <hr className="my-3 border-gray-200 dark:border-gray-600" />
            {Object.entries(remoteParticipants)
              .filter(([uid]) => uid !== String(localUID))
              .map(([uid, participant]) => (
                <ParticipantListItem
                  key={uid}
                  uid={uid}
                  name={participant.name}
                  micMuted={participant.micMuted}
                  videoMuted={participant.videoMuted}
                  isLocal={false}
                  isHost={isHost}
                  onMuteAudio={handleMuteAudio}
                  onMuteVideo={handleMuteVideo}
                  onUnmuteAudio={handleUnmuteAudio}
                  onUnmuteVideo={handleUnmuteVideo}
                />
              ))}
          </div>
        </BottomSheet>
      )}

      <TourOverlay {...tour} />

      <Modal
        isOpen={!!pendingUnmuteRequest}
        onClose={declineUnmuteRequest}
        title="Unmute Request"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            <strong>{pendingUnmuteRequest?.fromName}</strong> (Host) is
            requesting you to unmute your{" "}
            {pendingUnmuteRequest?.mediaType === "both"
              ? "microphone and camera"
              : pendingUnmuteRequest?.mediaType}
            .
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your privacy is protected. You can accept or decline this request.
          </p>
          <div className="flex space-x-3 pt-2">
            <Button onClick={acceptUnmuteRequest} variant="primary">
              Accept
            </Button>
            <Button onClick={declineUnmuteRequest} variant="secondary">
              Decline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VideoCallScreen;
