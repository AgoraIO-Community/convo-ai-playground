"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdTimer } from "react-icons/md";
import AgentTile from "@/components/AgentTile";
import CallExperienceModeSwitch from "@/components/CallExperienceModeSwitch";
import Controls from "@/components/Controls";
import TeacherStage from "@/components/teacher/TeacherStage";
import TranscriptDrawer from "@/components/TranscriptDrawer";
import TranscriptSidePanel from "@/components/TranscriptSidePanel";
import VideoTile from "@/components/VideoTile";
import VoiceAgentStage from "@/components/VoiceAgentStage";
import { useAgora } from "@/hooks/useAgora";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import { useTeacherBoardSession } from "@/hooks/useTeacherBoardSession";
import { useTeacherLessonDirector } from "@/hooks/useTeacherLessonDirector";
import { showToast } from "@/services/uiService";
import useAppStore from "@/store/useAppStore";
import type {
  CallExperienceMode,
  StandardCallExperienceMode,
} from "@/types/callExperience";

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
  const agentId = useAppStore((state) => state.agentId);
  const agentState = useAppStore((state) => state.agentState);
  const agentRtcUid = useAppStore((state) => state.agentRtcUid);
  const agentAvatarRtcUid = useAppStore((state) => state.agentAvatarRtcUid);
  const agentSettings = useAppStore((state) => state.agentSettings);
  const transcriptItems = useAppStore((state) => state.transcriptItems);
  const addUserSentMessage = useAppStore((state) => state.addUserSentMessage);
  const transcriptionMode = useAppStore((state) => state.transcriptionMode);
  const sessionStartTime = useAppStore((state) => state.sessionStartTime);
  const [remainingMs, setRemainingMs] = useState(SESSION_DURATION_MS);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const initialVideoMutedRef = useRef(videoMuted);
  const [callExperienceMode, setCallExperienceMode] =
    useState<CallExperienceMode>("teacher");
  const previousNonTeacherModeRef = useRef<StandardCallExperienceMode>(
    initialVideoMutedRef.current ? "voice" : "video",
  );
  const didApplyTeacherDefaultRef = useRef(false);
  const [isModeChanging, setIsModeChanging] = useState(false);
  const isEndingRef = useRef(false);

  const {
    leaveCall,
    localTracks,
    avatarVideoTrack,
    setLocalVideoEnabled,
    rtcClient,
    rtmClient,
  } = useAgora();

  useEffect(() => {
    if (didApplyTeacherDefaultRef.current) return;
    didApplyTeacherDefaultRef.current = true;
    void setLocalVideoEnabled(false).catch(() => {
      showToast("Camera could not be disabled for Teacher Mode.", "error");
    });
  }, [setLocalVideoEnabled]);

  const { sendChatMessage, manualSOS, manualEOS } = useConversationalAI({
    rtcClient,
    rtmClient,
    channelId,
    isAgentActive,
    transcriptionMode,
    agentRtcUid,
  });
  const teacher = useTeacherBoardSession(agentState);
  const pauseTeacherDemo = teacher.pauseDemo;
  const lessonDirector = useTeacherLessonDirector({
    active: callExperienceMode === "teacher" && isAgentActive,
    agentId,
    agentState,
    localUID,
    transcriptItems,
    teacherSession: teacher.session,
    boardState: teacher.boardState,
    clearBoard: teacher.clearBoard,
  });

  const handleTeacherMessage = useCallback(
    async (text: string, image?: File): Promise<void> => {
      const question = text.trim();
      if (image) {
        showToast(
          "Teacher Mode currently accepts text or spoken questions, not image attachments.",
          "info",
        );
        return;
      }
      if (!question) return;
      if (!isAgentActive || !agentId || !teacher.session) {
        showToast("Start the agent and wait for the teacher board to be ready.", "warning");
        return;
      }
      teacher.pauseDemo();
      addUserSentMessage({ text: question });
      await lessonDirector.sendTeacherQuestion(question);
    },
    [
      addUserSentMessage,
      agentId,
      isAgentActive,
      lessonDirector,
      teacher,
    ],
  );

  const endCall = useCallback(
    async (reason: "ended" | "expired"): Promise<void> => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      try {
        teacher.pauseDemo();
        await leaveCall();
        router.replace(`/call-ended?reason=${reason}`);
      } catch (error) {
        isEndingRef.current = false;
        throw error;
      }
    },
    [leaveCall, router, teacher],
  );

  const handleEndCall = useCallback(
    async (): Promise<void> => endCall("ended"),
    [endCall],
  );

  const handleExperienceModeChange = useCallback(
    async (nextMode: StandardCallExperienceMode): Promise<void> => {
      if (nextMode === callExperienceMode || isModeChanging) return;
      if (isAgentActive) {
        showToast("Stop the agent before switching call modes.", "info");
        return;
      }
      setIsModeChanging(true);
      try {
        await setLocalVideoEnabled(nextMode === "video");
        previousNonTeacherModeRef.current = nextMode;
        if (callExperienceMode === "teacher") teacher.pauseDemo();
        setCallExperienceMode(nextMode);
      } catch {
        if (nextMode === "video") {
          await setLocalVideoEnabled(false).catch(() => undefined);
          previousNonTeacherModeRef.current = "voice";
          teacher.pauseDemo();
          setCallExperienceMode("voice");
          showToast(
            "Camera unavailable, so the call returned to Voice Agent mode.",
            "error",
          );
        } else {
          showToast("Unable to switch to voice mode.", "error");
        }
      } finally {
        setIsModeChanging(false);
      }
    }, [
      callExperienceMode,
      isAgentActive,
      isModeChanging,
      setLocalVideoEnabled,
      teacher,
    ],
  );

  const handleTeacherModeToggle = useCallback(async (): Promise<void> => {
    if (isModeChanging) return;
    if (isAgentActive) {
      showToast("Stop the agent before switching Teacher Mode.", "info");
      return;
    }
    setIsModeChanging(true);
    try {
      if (callExperienceMode !== "teacher") {
        previousNonTeacherModeRef.current = callExperienceMode;
        await setLocalVideoEnabled(false);
        setCallExperienceMode("teacher");
        return;
      }

      teacher.pauseDemo();
      const restoreMode = previousNonTeacherModeRef.current;
      if (restoreMode === "video") {
        try {
          await setLocalVideoEnabled(true);
          setCallExperienceMode("video");
        } catch {
          await setLocalVideoEnabled(false).catch(() => undefined);
          previousNonTeacherModeRef.current = "voice";
          setCallExperienceMode("voice");
          showToast(
            "Camera unavailable, so Teacher Mode returned to Voice Agent mode.",
            "error",
          );
        }
      } else {
        await setLocalVideoEnabled(false);
        setCallExperienceMode("voice");
      }
    } finally {
      setIsModeChanging(false);
    }
  }, [
    callExperienceMode,
    isAgentActive,
    isModeChanging,
    setLocalVideoEnabled,
    teacher,
  ]);

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

  useEffect(() => {
    if (
      callExperienceMode === "teacher" &&
      lessonDirector.status === "planning"
    ) {
      pauseTeacherDemo();
    }
  }, [callExperienceMode, lessonDirector.status, pauseTeacherDemo]);

  const canSendChat = transcriptionMode === "rtm" && Boolean(agentRtcUid);
  const canSendTeacherQuestion =
    callExperienceMode === "teacher" &&
    canSendChat &&
    isAgentActive &&
    Boolean(agentId) &&
    Boolean(teacher.session);
  const transcript = (
    <TranscriptSidePanel
      isOpen={isTranscriptOpen}
      onClose={() => setIsTranscriptOpen(false)}
      embedded
      showCloseButton
      onSendMessage={
        callExperienceMode === "teacher"
          ? canSendTeacherQuestion
            ? handleTeacherMessage
            : undefined
          : canSendChat
            ? sendChatMessage
            : undefined
      }
    />
  );

  return (
    <div className="flex h-screen-dvh flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:flex-nowrap sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">
            {callExperienceMode === "teacher"
              ? "AI Teacher classroom"
              : "Private agent call"}
          </p>
          <p className="hidden text-xs text-slate-400 sm:block">
            {callExperienceMode === "teacher"
              ? "Powered by Agora Conversational AI"
              : transcriptionMode === "rtm"
                ? "Connected with Agora RTC + RTM"
                : "Connected with Agora RTC"}
          </p>
        </div>

        <div className="order-3 flex w-full justify-center sm:order-none sm:w-auto">
          <CallExperienceModeSwitch
            value={callExperienceMode}
            onChange={(mode) => void handleExperienceModeChange(mode)}
            disabled={isModeChanging}
          />
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
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div
            className={`absolute inset-3 z-10 sm:inset-5 ${
              callExperienceMode === "teacher"
                ? "visible pointer-events-auto"
                : "invisible pointer-events-none"
            }`}
            aria-hidden={callExperienceMode !== "teacher"}
          >
            <div className="mx-auto h-full w-full max-w-7xl">
              <TeacherStage
                active={callExperienceMode === "teacher"}
                teacher={teacher}
                agentId={agentId}
                agentName={agentSettings?.name || "AI Agent"}
                agentState={agentState}
                transcriptionMode={transcriptionMode}
                avatarVideoTrack={avatarVideoTrack}
                avatarExpected={
                  isAgentActive && Boolean(agentSettings?.avatar?.enable)
                }
                lessonStatus={lessonDirector.status}
                lessonProgress={lessonDirector.progress}
                onClearBoard={lessonDirector.cancelLesson}
              />
            </div>
          </div>

          <div
            className={`flex h-full w-full items-center justify-center overflow-y-auto p-3 sm:p-5 ${
              callExperienceMode === "teacher" ? "invisible" : "visible"
            }`}
            aria-hidden={callExperienceMode === "teacher"}
          >
          {callExperienceMode === "voice" ? (
            <div className="h-full max-h-[44rem] min-h-[22rem] w-full max-w-4xl">
              <VoiceAgentStage
                agentId={agentId}
                agentName={agentSettings?.name || "AI Agent"}
                agentState={agentState}
                isAgentActive={isAgentActive}
                transcriptionMode={transcriptionMode}
                avatarWaiting={Boolean(agentSettings?.avatar?.enable)}
              />
            </div>
          ) : callExperienceMode === "video" ? (
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
                  {avatarVideoTrack ? (
                    <AgentTile
                      agentId={agentId}
                      agentUid={agentAvatarRtcUid || agentRtcUid}
                      agentState={agentState}
                      agentName={agentSettings?.name || "AI Agent"}
                      transcriptionMode={transcriptionMode}
                      videoTrack={avatarVideoTrack}
                    />
                  ) : (
                    <VoiceAgentStage
                      compact
                      agentId={agentId}
                      agentName={agentSettings?.name || "AI Agent"}
                      agentState={agentState}
                      isAgentActive
                      transcriptionMode={transcriptionMode}
                      avatarWaiting={Boolean(agentSettings?.avatar?.enable)}
                    />
                  )}
                </div>
              )}
            </div>
          ) : null}
          </div>

          <TranscriptDrawer
            isOpen={isTranscriptOpen}
            onOpen={() => setIsTranscriptOpen(true)}
            onClose={() => setIsTranscriptOpen(false)}
          >
            {transcript}
          </TranscriptDrawer>
        </main>
      </div>

      <Controls
        onEndCall={handleEndCall}
        experienceMode={callExperienceMode}
        teacherSession={
          callExperienceMode === "teacher" ? teacher.session : null
        }
        onTeacherModeToggle={handleTeacherModeToggle}
        teacherModeLoading={isModeChanging}
        manualTurnControls={
          isAgentActive &&
          transcriptionMode === "rtm" &&
          agentSettings?.enable_turn_detection === true &&
          (agentSettings.turn_detection?.config?.start_of_speech?.mode ===
            "manual" ||
            agentSettings.turn_detection?.config?.end_of_speech?.mode ===
              "manual")
            ? {
                ...(agentSettings.turn_detection.config?.start_of_speech
                  ?.mode === "manual"
                  ? { onStart: manualSOS }
                  : {}),
                ...(agentSettings.turn_detection.config?.end_of_speech?.mode ===
                "manual"
                  ? { onEnd: manualEOS }
                  : {}),
              }
            : undefined
        }
      />

    </div>
  );
};

export default VideoCallScreen;
