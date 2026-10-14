"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MdCallEnd,
  MdMic,
  MdMicOff,
  MdPlayArrow,
  MdSchool,
  MdSettings,
  MdSync,
  MdStop,
  MdVideocam,
  MdVideocamOff,
} from "react-icons/md";
import { useTeacherLocale } from "@/locales/TeacherLocaleProvider";
import { inviteAgent, stopAgent, updateAgent } from "@/api/agentApi";
import AgentGlyph from "@/components/AgentGlyph";
import SettingsSidebar from "@/components/SettingsSidebar";
import {
  getAiTeacherLearnerName,
  withAiTeacherRuntimeDefaults,
} from "@/constants/aiTeacherDefaults";
import { useAgora } from "@/hooks/useAgora";
import {
  getTranscriptTransport,
  withCustomPayloadTranscriptTransport,
  withTranscriptTransport,
} from "@/lib/agora/transcriptTransport";
import { showToast } from "@/services/uiService";
import {
  getCustomAgentSettings,
  setAgentSettings as persistAgentSettings,
} from "@/services/settingsDb";
import useAppStore from "@/store/useAppStore";
import type { AgentSettings } from "@/types/agora";
import type { CallExperienceMode } from "@/types/callExperience";
import type { TeacherSessionCredentials } from "@/types/teacher";
import { sanitizeCustomJoinPayload } from "@/utils/customPayloadSanitize";

interface ControlsProps {
  onEndCall: () => Promise<void>;
  experienceMode: CallExperienceMode;
  manualTurnControls?: {
    onStart?: () => Promise<string>;
    onEnd?: () => Promise<string>;
  };
  teacherSession?: TeacherSessionCredentials | null;
  autoStartAgent?: boolean;
  onTeacherModeToggle?: () => Promise<void>;
  teacherModeLoading?: boolean;
}

function hasUpdatableChanges(
  previous: AgentSettings | null,
  next: AgentSettings,
): boolean {
  if (!previous) return true;
  return (
    JSON.stringify(previous.llm?.system_messages) !==
      JSON.stringify(next.llm?.system_messages) ||
    JSON.stringify(previous.llm?.params) !== JSON.stringify(next.llm?.params)
  );
}

function hasRestartRequiredChanges(
  previous: AgentSettings | null,
  next: AgentSettings,
): boolean {
  if (!previous) return false;
  return (
    JSON.stringify(previous.tts) !== JSON.stringify(next.tts) ||
    JSON.stringify(previous.asr) !== JSON.stringify(next.asr) ||
    JSON.stringify(previous.turn_detection) !==
      JSON.stringify(next.turn_detection) ||
    JSON.stringify(previous.advanced_features) !==
      JSON.stringify(next.advanced_features) ||
    previous.llm?.url !== next.llm?.url ||
    previous.llm?.api_key !== next.llm?.api_key ||
    previous.llm?.max_history !== next.llm?.max_history ||
    previous.llm?.style !== next.llm?.style ||
    previous.llm?.greeting_message !== next.llm?.greeting_message ||
    previous.llm?.failure_message !== next.llm?.failure_message
  );
}

const Controls: React.FC<ControlsProps> = ({
  onEndCall,
  experienceMode,
  manualTurnControls,
  teacherSession,
  autoStartAgent = false,
  onTeacherModeToggle,
  teacherModeLoading = false,
}) => {
  const { locale, profile } = useTeacherLocale();
  const teacherCopy = experienceMode === "teacher" ? profile.messages.controls : null;
  const audioMuted = useAppStore((state) => state.audioMuted);
  const videoMuted = useAppStore((state) => state.videoMuted);
  const channelId = useAppStore((state) => state.channelId);
  const localUID = useAppStore((state) => state.localUID);
  const localUsername = useAppStore((state) => state.localUsername);
  const agentId = useAppStore((state) => state.agentId);
  const isAgentActive = useAppStore((state) => state.isAgentActive);
  const isAgentLoading = useAppStore((state) => state.isAgentLoading);
  const isAgentUpdating = useAppStore((state) => state.isAgentUpdating);
  const agentSettings = useAppStore((state) => state.agentSettings);
  const setAgentActive = useAppStore((state) => state.setAgentActive);
  const setAgentLoading = useAppStore((state) => state.setAgentLoading);
  const setAgentUpdating = useAppStore((state) => state.setAgentUpdating);
  const clearAgent = useAppStore((state) => state.clearAgent);
  const setAgentSettings = useAppStore((state) => state.setAgentSettings);
  const { configureRtm, toggleLocalAudio, toggleLocalVideo } = useAgora();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [manualTurnPending, setManualTurnPending] = useState<
    "start" | "end" | null
  >(null);
  const autoStartAttemptedRef = useRef(false);

  const handleManualTurn = useCallback(
    async (kind: "start" | "end") => {
      const action =
        kind === "start"
          ? manualTurnControls?.onStart
          : manualTurnControls?.onEnd;
      if (!action || manualTurnPending) return;
      setManualTurnPending(kind);
      try {
        await action();
        showToast(
          kind === "start"
            ? "Manual start-of-speech marker sent"
            : "Manual end-of-speech marker sent",
          "success",
        );
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Manual turn request failed",
          "error",
        );
      } finally {
        setManualTurnPending(null);
      }
    },
    [manualTurnControls, manualTurnPending],
  );

  const handleAudioToggle = useCallback(async (): Promise<void> => {
    try {
      await toggleLocalAudio();
    } catch {
      showToast(teacherCopy?.micFailed ?? "Failed to toggle microphone", "error");
    }
  }, [toggleLocalAudio, teacherCopy]);

  const handleVideoToggle = useCallback(async (): Promise<void> => {
    try {
      await toggleLocalVideo();
    } catch {
      showToast("Failed to toggle camera", "error");
    }
  }, [toggleLocalVideo]);

  const handleEndCall = useCallback(async (): Promise<void> => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await onEndCall();
    } catch (error) {
      setIsEnding(false);
      showToast(
        error instanceof Error ? error.message : "Failed to end the call",
        "error",
      );
    }
  }, [isEnding, onEndCall]);

  const handleInviteAgent = useCallback(async (): Promise<void> => {
    if (isAgentActive || isAgentLoading) return;
    if (!localUID || !channelId) {
      showToast(teacherCopy?.notReady ?? "The call is not ready for the agent yet.", "error");
      return;
    }
    if (!agentSettings) {
      setIsSettingsOpen(true);
      return;
    }
    if (experienceMode === "teacher" && !teacherSession) {
      showToast(
        profile.messages.controls.boardNotReady,
        "info",
      );
      return;
    }

    setAgentLoading(true);
    try {
      const customSettings = await getCustomAgentSettings();
      const useCustomPayload = Boolean(
        experienceMode !== "teacher" &&
          customSettings?.useCustomPayload &&
          customSettings.customPayloadJson?.trim(),
      );
      let customJoinPayload:
        | { name: string; properties: Record<string, unknown> }
        | undefined;

      if (useCustomPayload) {
        try {
          const parsed = JSON.parse(
            customSettings!.customPayloadJson!,
          ) as Record<string, unknown>;
          const sanitizedPayload = sanitizeCustomJoinPayload(parsed);
          customJoinPayload = sanitizedPayload
            ? withCustomPayloadTranscriptTransport(
                sanitizedPayload,
                getTranscriptTransport(agentSettings),
              )
            : undefined;
        } catch (error) {
          console.warn("Ignoring invalid custom agent payload", error);
        }
      }

      const experienceSettings =
        experienceMode === "teacher"
          ? withAiTeacherRuntimeDefaults(agentSettings, locale)
          : agentSettings;
      const normalizedSettings = withTranscriptTransport(experienceSettings);
      const customAdvancedFeatures = customJoinPayload?.properties
        .advanced_features as Record<string, unknown> | undefined;
      const transport = customJoinPayload
        ? customAdvancedFeatures?.enable_rtm === false
          ? "rtc"
          : "rtm"
        : getTranscriptTransport(normalizedSettings);
      await configureRtm(transport === "rtm");
      const greetingName =
        experienceMode === "teacher"
          ? getAiTeacherLearnerName(localUsername)
          : localUsername || undefined;
      const result = await inviteAgent(channelId, localUID, normalizedSettings, {
        useCustomPayload: Boolean(customJoinPayload),
        customJoinPayload,
        username: greetingName,
        teacherSession: experienceMode === "teacher" && teacherSession
          ? {
              sessionId: teacherSession.sessionId,
              token: teacherSession.token,
            }
          : undefined,
      });
      useAppStore.getState().setTranscriptionMode(transport);
      setAgentActive(
        result.agentId,
        result.agentRtcUid || "0",
        result.avatarRtcUid,
      );
      useAppStore.getState().appendAgentSession({
        agentId: result.agentId,
        joinedAt: Date.now(),
        channelId,
      });
      showToast(teacherCopy?.joined ?? "AI agent joined the call", "success");
    } catch (error) {
      console.error("Unable to start the AI agent", error);
      setAgentLoading(false);
      showToast(
        teacherCopy?.startFailed ?? (error instanceof Error ? error.message : "Failed to start AI agent"),
        "error",
      );
    }
  }, [
    agentSettings,
    channelId,
    configureRtm,
    locale,
    profile,
    teacherCopy,
    experienceMode,
    isAgentActive,
    isAgentLoading,
    localUID,
    localUsername,
    setAgentActive,
    setAgentLoading,
    teacherSession,
  ]);

  useEffect(() => {
    if (
      !autoStartAgent ||
      autoStartAttemptedRef.current ||
      experienceMode !== "teacher" ||
      isAgentActive ||
      isAgentLoading ||
      !agentSettings ||
      !localUID ||
      !channelId ||
      !teacherSession
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void handleInviteAgent();
  }, [
    agentSettings,
    autoStartAgent,
    channelId,
    experienceMode,
    handleInviteAgent,
    isAgentActive,
    isAgentLoading,
    localUID,
    teacherSession,
  ]);

  const handleStopAgent = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    setAgentLoading(true);
    try {
      await stopAgent(agentId, agentSettings?.api_base_url);
      clearAgent();
      showToast(teacherCopy?.stopped ?? "AI agent stopped", "success");
    } catch (error) {
      console.warn("Unable to stop the AI agent", { category: error instanceof Error ? error.name : "UnknownError" });
      showToast(teacherCopy?.stopFailed ?? "Failed to stop AI agent", "error");
    } finally {
      setAgentLoading(false);
    }
  }, [agentId, agentSettings?.api_base_url, clearAgent, setAgentLoading, teacherCopy]);

  const handleToggleAgent = useCallback(async (): Promise<void> => {
    if (isAgentActive) await handleStopAgent();
    else await handleInviteAgent();
  }, [handleInviteAgent, handleStopAgent, isAgentActive]);

  const handleTeacherModeToggle = useCallback(async (): Promise<void> => {
    if (!onTeacherModeToggle) return;
    try {
      await onTeacherModeToggle();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Unable to change Teacher Mode",
        "error",
      );
    }
  }, [onTeacherModeToggle]);

  const handleSaveAgentSettings = useCallback(
    async (settings: AgentSettings): Promise<void> => {
      const previousSettings = useAppStore.getState().agentSettings;
      const persistedSettings = withTranscriptTransport(settings);
      const runtimeSettings =
        experienceMode === "teacher"
          ? withAiTeacherRuntimeDefaults(persistedSettings, locale)
          : persistedSettings;
      const previousRuntimeSettings =
        previousSettings && experienceMode === "teacher"
          ? withAiTeacherRuntimeDefaults(previousSettings, locale)
          : previousSettings;
      setAgentSettings(persistedSettings);

      try {
        await persistAgentSettings(persistedSettings);
      } catch (error) {
        console.error("Unable to persist agent settings", error);
      }

      if (!isAgentActive || !agentId || !channelId) {
        showToast(teacherCopy?.saved ?? "Agent settings saved", "success");
        return;
      }

      const canUpdate = hasUpdatableChanges(
        previousRuntimeSettings,
        runtimeSettings,
      );
      const needsRestart = hasRestartRequiredChanges(
        previousRuntimeSettings,
        runtimeSettings,
      );
      if (canUpdate) {
        setAgentUpdating(true);
        try {
          await updateAgent(agentId, channelId, runtimeSettings);
          showToast(teacherCopy?.updated ?? "Agent configuration updated", "success");
        } catch (error) {
          showToast(
            error instanceof Error
              ? error.message
              : "Failed to update agent configuration",
            "error",
          );
        } finally {
          setAgentUpdating(false);
        }
      }
      if (needsRestart) {
        showToast(
          teacherCopy?.restart ?? "Restart the agent for voice and advanced changes to take effect",
          "info",
        );
      }
    },
    [
      agentId,
      channelId,
      experienceMode,
      locale,
      teacherCopy,
      isAgentActive,
      setAgentSettings,
      setAgentUpdating,
    ],
  );

  const circleButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:h-12 sm:w-12";
  const agentLabel = isAgentActive ? (teacherCopy?.stop ?? "Stop agent") : (teacherCopy?.start ?? "Start agent");

  return (
    <>
      <div className="flex min-h-20 items-center justify-center border-t border-white/10 bg-slate-950/95 px-2 py-3 shadow-2xl backdrop-blur sm:px-5">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => void handleAudioToggle()}
            className={circleButton}
            aria-label={audioMuted ? (teacherCopy?.unmute ?? "Unmute microphone") : (teacherCopy?.mute ?? "Mute microphone")}
            title={audioMuted ? (teacherCopy?.unmute ?? "Unmute microphone") : (teacherCopy?.mute ?? "Mute microphone")}
          >
            {audioMuted ? <MdMicOff /> : <MdMic />}
          </button>
          {manualTurnControls && (
            <div className="flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 p-1">
              {manualTurnControls.onStart && <button
                type="button"
                onClick={() => void handleManualTurn("start")}
                disabled={manualTurnPending !== null}
                className={`${circleButton} h-9 w-auto gap-1 px-2 text-sm sm:h-10 sm:w-auto`}
                aria-label="Manual start of speech"
                title="Send manual start-of-speech marker"
              >
                <MdPlayArrow />
                <span className="hidden sm:inline">Start turn</span>
              </button>}
              {manualTurnControls.onEnd && <button
                type="button"
                onClick={() => void handleManualTurn("end")}
                disabled={manualTurnPending !== null}
                className={`${circleButton} h-9 w-auto gap-1 px-2 text-sm sm:h-10 sm:w-auto`}
                aria-label="Manual end of speech"
                title="Send manual end-of-speech marker"
              >
                <MdStop />
                <span className="hidden sm:inline">End turn</span>
              </button>}
            </div>
          )}
          {experienceMode === "video" && (
            <button
              type="button"
              onClick={() => void handleVideoToggle()}
              className={circleButton}
              aria-label={videoMuted ? "Turn camera on" : "Turn camera off"}
              title={videoMuted ? "Turn camera on" : "Turn camera off"}
            >
              {videoMuted ? <MdVideocamOff /> : <MdVideocam />}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleEndCall()}
            disabled={isEnding}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 text-2xl text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60 sm:h-14 sm:w-14"
            aria-label={teacherCopy?.end ?? "End call"}
            title={teacherCopy?.end ?? "End call"}
          >
            <MdCallEnd />
          </button>
          <button
            type="button"
            onClick={() => void handleToggleAgent()}
            disabled={
              isAgentLoading ||
              isAgentUpdating ||
              (!isAgentActive &&
                experienceMode === "teacher" &&
                !teacherSession)
            }
            className={`${circleButton} w-auto gap-2 px-3 disabled:cursor-wait disabled:opacity-60 sm:w-auto`}
            aria-label={agentLabel}
            title={agentLabel}
          >
            {isAgentLoading || isAgentUpdating ? (
              <MdSync className="animate-spin" />
            ) : (
              <AgentGlyph size="control" />
            )}
            <span className="hidden text-sm font-semibold sm:inline">
              {isAgentLoading
                ? (teacherCopy?.starting ?? "Connecting")
                : isAgentUpdating
                  ? (teacherCopy?.updating ?? "Updating")
                  : agentLabel}
            </span>
          </button>
          {onTeacherModeToggle && (
            <button
              type="button"
              onClick={() => void handleTeacherModeToggle()}
              disabled={teacherModeLoading}
              className={`${circleButton} ${
                experienceMode === "teacher"
                  ? "border-cyan-200/45 bg-cyan-300/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                  : ""
              } disabled:cursor-wait disabled:opacity-60`}
              aria-label={
                experienceMode === "teacher"
                  ? (teacherCopy?.teacherMode ?? "Exit Teacher Mode")
                  : "Enter Teacher Mode"
              }
              aria-pressed={experienceMode === "teacher"}
              title={
                experienceMode === "teacher"
                  ? (teacherCopy?.teacherMode ?? "Exit Teacher Mode")
                  : "Enter Teacher Mode"
              }
            >
              {teacherModeLoading ? (
                <MdSync className="animate-spin" />
              ) : (
                <MdSchool />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={circleButton}
            aria-label={teacherCopy?.settings ?? "Agent settings"}
            title={teacherCopy?.settings ?? "Agent settings"}
          >
            <MdSettings />
          </button>
        </div>
      </div>

      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveAgentSettings={handleSaveAgentSettings}
        isAgentUpdating={isAgentUpdating}
        isAgentActive={isAgentActive}
      />
    </>
  );
};

export default Controls;
