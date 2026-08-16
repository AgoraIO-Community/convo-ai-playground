"use client";

import { useCallback, useEffect, useRef } from "react";
import type { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import {
  ChatMessagePriority,
  ChatMessageType,
  type RTCEngine,
  type RTMEngine,
} from "agora-agent-client-toolkit";
import {
  startAgoraClientToolkit,
  type AgoraClientToolkitSession,
} from "@/lib/agora/clientToolkitAdapter";
import useAppStore from "@/store/useAppStore";

interface UseConversationalAIOptions {
  rtcClient: IAgoraRTCClient | null;
  rtmClient: unknown | null;
  channelId: string | null;
  isAgentActive: boolean;
  transcriptionMode: "rtc" | "rtm";
  agentRtcUid: string | null;
}

/** Connects the app store and chat UI to Agora's published client toolkit. */
export const useConversationalAI = ({
  rtcClient,
  rtmClient,
  channelId,
  isAgentActive,
  transcriptionMode,
  agentRtcUid,
}: UseConversationalAIOptions) => {
  const setAgentState = useAppStore((state) => state.setAgentState);
  const setTranscriptItems = useAppStore((state) => state.setTranscriptItems);
  const setCurrentInProgressMessage = useAppStore(
    (state) => state.setCurrentInProgressMessage,
  );
  const addUserSentMessage = useAppStore((state) => state.addUserSentMessage);
  const addLiveAgentMetric = useAppStore((state) => state.addLiveAgentMetric);
  const addLiveAgentError = useAppStore((state) => state.addLiveAgentError);
  const addLiveMessageError = useAppStore((state) => state.addLiveMessageError);
  const addManualTurnResult = useAppStore(
    (state) => state.addManualTurnResult,
  );
  const localUID = useAppStore((state) => state.localUID);
  const transcriptRenderMode = useAppStore(
    (state) => state.transcriptRenderMode,
  );
  const sessionRef = useRef<AgoraClientToolkitSession | null>(null);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const renderModeRef = useRef(transcriptRenderMode);
  renderModeRef.current = transcriptRenderMode;

  useEffect(() => {
    if (
      !isAgentActive ||
      !rtcClient ||
      (transcriptionMode === "rtm" && !rtmClient) ||
      !channelId ||
      !localUID ||
      !agentRtcUid
    ) {
      return;
    }

    let cancelled = false;
    let effectSession: AgoraClientToolkitSession | null = null;

    const startSession = lifecycleRef.current.then(async () => {
      if (cancelled) return;

      try {
        const initialRenderMode = renderModeRef.current;
        const session = await startAgoraClientToolkit({
          rtcEngine: rtcClient as unknown as RTCEngine,
          rtmEngine: rtmClient ? (rtmClient as RTMEngine) : null,
          channelId,
          localRtcUid: String(localUID),
          renderMode: initialRenderMode,
          enableLog: process.env.NODE_ENV === "development",
          onTranscript: ({ completed, inProgress }) => {
            if (cancelled) return;
            setTranscriptItems(completed);
            setCurrentInProgressMessage(inProgress);
          },
          onAgentState: (state) => {
            if (!cancelled) setAgentState(state);
          },
          onAgentMetric: (event) => {
            if (!cancelled) addLiveAgentMetric(event);
          },
          onAgentError: (event) => {
            if (!cancelled) addLiveAgentError(event);
          },
          onMessageError: (event) => {
            if (!cancelled) addLiveMessageError(event);
          },
          onManualTurnResult: (event) => {
            if (!cancelled) addManualTurnResult(event);
          },
        });

        if (cancelled) {
          session.destroy();
          return;
        }

        effectSession = session;
        sessionRef.current = session;
        if (renderModeRef.current !== initialRenderMode) {
          session.setRenderMode(renderModeRef.current);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[useConversationalAI] Unable to initialize Agora client toolkit",
            error,
          );
        }
      }
    });

    lifecycleRef.current = startSession;

    return () => {
      cancelled = true;
      if (effectSession) {
        effectSession.destroy();
        if (sessionRef.current === effectSession) {
          sessionRef.current = null;
        }
        effectSession = null;
      }
    };
  }, [
    isAgentActive,
    rtcClient,
    rtmClient,
    channelId,
    localUID,
    agentRtcUid,
    transcriptionMode,
    setTranscriptItems,
    setCurrentInProgressMessage,
    setAgentState,
    addLiveAgentMetric,
    addLiveAgentError,
    addLiveMessageError,
    addManualTurnResult,
  ]);

  useEffect(() => {
    sessionRef.current?.setRenderMode(transcriptRenderMode);
  }, [transcriptRenderMode]);

  useEffect(() => {
    if (!isAgentActive) {
      setTranscriptItems([]);
      setCurrentInProgressMessage(null);
    }
  }, [isAgentActive, setTranscriptItems, setCurrentInProgressMessage]);

  const sendChatMessage = useCallback(
    async (text: string, image?: File) => {
      const session = sessionRef.current;
      const targetUid = agentRtcUid;
      if (!session || !targetUid || transcriptionMode !== "rtm") {
        console.error("Cannot send message: toolkit is not ready for RTM chat", {
          hasSession: Boolean(session),
          agentRtcUid: targetUid,
          transcriptionMode,
        });
        return;
      }

      try {
        const trimmedText = text.trim();
        let imageUrl: string | undefined;

        if (image) {
          const formData = new FormData();
          formData.append("file", image);
          const uploadRes = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
          });
          if (!uploadRes.ok) {
            const errorBody = await uploadRes.json().catch(() => ({}));
            throw new Error(
              (errorBody as { error?: string }).error || "Image upload failed",
            );
          }
          const { url } = (await uploadRes.json()) as { url: string };
          imageUrl = url;
          await session.chat(targetUid, {
            messageType: ChatMessageType.IMAGE,
            uuid: crypto.randomUUID(),
            url,
          });
        }

        if (trimmedText) {
          await session.chat(targetUid, {
            messageType: ChatMessageType.TEXT,
            priority: ChatMessagePriority.INTERRUPTED,
            responseInterruptable: true,
            text: trimmedText,
          });
        }

        if (imageUrl || trimmedText) {
          addUserSentMessage({ text: trimmedText || undefined, imageUrl });
        }
      } catch (error) {
        console.error("Failed to send chat message:", error);
        throw error;
      }
    },
    [agentRtcUid, transcriptionMode, addUserSentMessage],
  );

  const manualSOS = useCallback(async (): Promise<string> => {
    const session = sessionRef.current;
    if (!session || !agentRtcUid || transcriptionMode !== "rtm") {
      throw new Error("Manual start of speech requires an active RTM agent session.");
    }
    return session.manualSOS(agentRtcUid);
  }, [agentRtcUid, transcriptionMode]);

  const manualEOS = useCallback(async (): Promise<string> => {
    const session = sessionRef.current;
    if (!session || !agentRtcUid || transcriptionMode !== "rtm") {
      throw new Error("Manual end of speech requires an active RTM agent session.");
    }
    return session.manualEOS(agentRtcUid);
  }, [agentRtcUid, transcriptionMode]);

  return { sendChatMessage, manualSOS, manualEOS };
};
