"use client";

import { useCallback, useState } from "react";
import {
  MdCallEnd,
  MdMic,
  MdMicOff,
  MdSettings,
  MdSmartToy,
  MdSync,
  MdVideocam,
  MdVideocamOff,
} from "react-icons/md";
import { inviteAgent, stopAgent, updateAgent } from "@/api/agentApi";
import SettingsSidebar from "@/components/SettingsSidebar";
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
import { sanitizeCustomJoinPayload } from "@/utils/customPayloadSanitize";

interface ControlsProps {
  onEndCall: () => Promise<void>;
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

const Controls: React.FC<ControlsProps> = ({ onEndCall }) => {
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

  const handleAudioToggle = useCallback(async (): Promise<void> => {
    try {
      await toggleLocalAudio();
    } catch {
      showToast("Failed to toggle microphone", "error");
    }
  }, [toggleLocalAudio]);

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
    if (!localUID || !channelId) {
      showToast("The call is not ready for the agent yet.", "error");
      return;
    }
    if (!agentSettings) {
      setIsSettingsOpen(true);
      return;
    }

    setAgentLoading(true);
    try {
      const customSettings = await getCustomAgentSettings();
      const useCustomPayload = Boolean(
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

      const normalizedSettings = withTranscriptTransport(agentSettings);
      const customAdvancedFeatures = customJoinPayload?.properties
        .advanced_features as Record<string, unknown> | undefined;
      const transport = customJoinPayload
        ? customAdvancedFeatures?.enable_rtm === false
          ? "rtc"
          : "rtm"
        : getTranscriptTransport(normalizedSettings);
      await configureRtm(transport === "rtm");
      const result = await inviteAgent(channelId, localUID, normalizedSettings, {
        useCustomPayload: Boolean(customJoinPayload),
        customJoinPayload,
        username: localUsername || undefined,
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
      showToast("AI agent joined the call", "success");
    } catch (error) {
      console.error("Unable to start the AI agent", error);
      setAgentLoading(false);
      showToast(
        error instanceof Error ? error.message : "Failed to start AI agent",
        "error",
      );
    }
  }, [
    agentSettings,
    channelId,
    configureRtm,
    localUID,
    localUsername,
    setAgentActive,
    setAgentLoading,
  ]);

  const handleStopAgent = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    setAgentLoading(true);
    try {
      await stopAgent(agentId);
      showToast("AI agent stopped", "success");
    } catch (error) {
      console.error("Unable to stop the AI agent", error);
      showToast("Failed to stop AI agent", "error");
    } finally {
      clearAgent();
    }
  }, [agentId, clearAgent, setAgentLoading]);

  const handleToggleAgent = useCallback(async (): Promise<void> => {
    if (isAgentActive) await handleStopAgent();
    else await handleInviteAgent();
  }, [handleInviteAgent, handleStopAgent, isAgentActive]);

  const handleSaveAgentSettings = useCallback(
    async (settings: AgentSettings): Promise<void> => {
      const previousSettings = useAppStore.getState().agentSettings;
      const normalizedSettings = withTranscriptTransport(settings);
      setAgentSettings(normalizedSettings);

      try {
        await persistAgentSettings(normalizedSettings);
      } catch (error) {
        console.error("Unable to persist agent settings", error);
      }

      if (!isAgentActive || !agentId || !channelId) {
        showToast("Agent settings saved", "success");
        return;
      }

      const canUpdate = hasUpdatableChanges(previousSettings, normalizedSettings);
      const needsRestart = hasRestartRequiredChanges(
        previousSettings,
        normalizedSettings,
      );
      if (canUpdate) {
        setAgentUpdating(true);
        try {
          await updateAgent(agentId, channelId, normalizedSettings);
          showToast("Agent configuration updated", "success");
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
          "Restart the agent for voice and advanced changes to take effect",
          "info",
        );
      }
    },
    [
      agentId,
      channelId,
      isAgentActive,
      setAgentSettings,
      setAgentUpdating,
    ],
  );

  const circleButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:h-12 sm:w-12";
  const agentLabel = isAgentActive ? "Stop agent" : "Start agent";

  return (
    <>
      <div className="flex min-h-20 items-center justify-center border-t border-white/10 bg-slate-950/95 px-2 py-3 shadow-2xl backdrop-blur sm:px-5">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => void handleAudioToggle()}
            className={circleButton}
            aria-label={audioMuted ? "Unmute microphone" : "Mute microphone"}
            title={audioMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {audioMuted ? <MdMicOff /> : <MdMic />}
          </button>
          <button
            type="button"
            onClick={() => void handleVideoToggle()}
            className={circleButton}
            aria-label={videoMuted ? "Turn camera on" : "Turn camera off"}
            title={videoMuted ? "Turn camera on" : "Turn camera off"}
          >
            {videoMuted ? <MdVideocamOff /> : <MdVideocam />}
          </button>
          <button
            type="button"
            onClick={() => void handleEndCall()}
            disabled={isEnding}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 text-2xl text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60 sm:h-14 sm:w-14"
            aria-label="End call"
            title="End call"
          >
            <MdCallEnd />
          </button>
          <button
            type="button"
            onClick={() => void handleToggleAgent()}
            disabled={isAgentLoading || isAgentUpdating}
            className={`${circleButton} w-auto gap-2 px-3 disabled:cursor-wait disabled:opacity-60 sm:w-auto`}
            aria-label={agentLabel}
            title={agentLabel}
          >
            {isAgentLoading || isAgentUpdating ? (
              <MdSync className="animate-spin" />
            ) : (
              <MdSmartToy />
            )}
            <span className="hidden text-sm font-semibold sm:inline">
              {isAgentLoading
                ? "Connecting"
                : isAgentUpdating
                  ? "Updating"
                  : agentLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={circleButton}
            aria-label="Agent settings"
            title="Agent settings"
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
