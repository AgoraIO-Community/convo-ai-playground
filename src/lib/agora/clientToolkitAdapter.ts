import {
  AgoraVoiceAI,
  AgoraVoiceAIEvents,
  TranscriptHelperMode,
  TurnStatus,
  type AgentTranscription,
  type AgoraVoiceAIConfig,
  type AgoraVoiceAIEventHandlers,
  type ChatMessageImage,
  type ChatMessageText,
  type RTCEngine,
  type RTMEngine,
  type TranscriptHelperItem,
  type UserTranscription,
} from "agora-agent-client-toolkit";
import type { EAgentState, ITranscriptHelperItem } from "@/types/agora";
import {
  EAgentState as AppAgentState,
  ETurnStatus,
  ETranscriptRenderMode,
} from "@/types/agora";

export interface NormalizedTranscript {
  completed: ITranscriptHelperItem[];
  inProgress: ITranscriptHelperItem | null;
}

interface NormalizeToolkitTranscriptOptions {
  localRtcUid?: string;
  pts?: number | null;
  useWordTiming?: boolean;
}

interface TranscriptWord {
  word: string;
  start_ms: number;
}

type WordTimingState = "disabled" | "waiting" | "active" | "fallback";

const WORD_TIMING_FALLBACK_MS = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function metadataObject(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  return typeof metadata.object === "string" ? metadata.object : null;
}

function validTranscriptWords(metadata: unknown): TranscriptWord[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.words)) return [];

  return metadata.words
    .filter(
      (word): word is TranscriptWord =>
        isRecord(word) &&
        typeof word.word === "string" &&
        word.word.length > 0 &&
        typeof word.start_ms === "number" &&
        Number.isFinite(word.start_ms),
    )
    .sort((left, right) => left.start_ms - right.start_ms);
}

function toAppTurnStatus(status: TurnStatus): ETurnStatus {
  switch (status) {
    case TurnStatus.IN_PROGRESS:
      return ETurnStatus.IN_PROGRESS;
    case TurnStatus.END:
      return ETurnStatus.END;
    case TurnStatus.INTERRUPTED:
      return ETurnStatus.INTERRUPTED;
  }
}

export function normalizeToolkitTranscript(
  history: ReadonlyArray<
    TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>
  >,
  options: NormalizeToolkitTranscriptOptions = {},
): NormalizedTranscript {
  const visibleItems: ITranscriptHelperItem[] = history
    .map((item) => {
      const object = metadataObject(item.metadata);
      const isUser = object === "user.transcription";
      const isAgent = object === "assistant.transcription";
      const words = isAgent ? validTranscriptWords(item.metadata) : [];
      const visibleWords =
        options.useWordTiming && options.pts != null
          ? words.filter((word) => word.start_ms <= options.pts!)
          : words;
      const isPartiallyRevealed =
        options.useWordTiming === true &&
        options.pts != null &&
        words.length > 0 &&
        visibleWords.length < words.length;

      return {
        ...item,
        uid:
          isUser && options.localRtcUid
            ? String(options.localRtcUid)
            : String(item.uid),
        text:
          options.useWordTiming && words.length > 0
            ? visibleWords.map((word) => word.word).join("")
            : item.text,
        status: isPartiallyRevealed
          ? ETurnStatus.IN_PROGRESS
          : toAppTurnStatus(item.status),
      };
    })
    .filter((item) => item.text.trim().length > 0);
  const completed = visibleItems
    .filter((item) => item.status !== ETurnStatus.IN_PROGRESS)
    .sort((left, right) => left.turn_id - right.turn_id);
  const inProgress =
    visibleItems.find((item) => item.status === ETurnStatus.IN_PROGRESS) ?? null;

  return { completed, inProgress };
}

export function toToolkitRenderMode(
  mode: ETranscriptRenderMode,
): TranscriptHelperMode {
  switch (mode) {
    case ETranscriptRenderMode.TEXT:
      return TranscriptHelperMode.TEXT;
    case ETranscriptRenderMode.WORD:
      return TranscriptHelperMode.WORD;
    case ETranscriptRenderMode.AUTO:
      return TranscriptHelperMode.AUTO;
  }
}

export interface ToolkitClient {
  on<Event extends keyof AgoraVoiceAIEventHandlers>(
    event: Event,
    handler: AgoraVoiceAIEventHandlers[Event],
  ): this;
  off<Event extends keyof AgoraVoiceAIEventHandlers>(
    event: Event,
    handler: AgoraVoiceAIEventHandlers[Event],
  ): this;
  subscribeMessage(channel: string): void;
  unsubscribe(): void;
  destroy(): void;
  chat(
    agentUserId: string,
    message: ChatMessageText | ChatMessageImage,
  ): Promise<void>;
}

interface ToolkitProvider {
  init(config: AgoraVoiceAIConfig): Promise<ToolkitClient>;
}

export interface StartAgoraClientToolkitOptions {
  rtcEngine: RTCEngine;
  rtmEngine?: RTMEngine | null;
  channelId: string;
  localRtcUid: string;
  renderMode: ETranscriptRenderMode;
  enableLog?: boolean;
  onTranscript(snapshot: NormalizedTranscript): void;
  onAgentState(state: EAgentState): void;
}

export interface AgoraClientToolkitSession {
  chat(
    agentUserId: string,
    message: ChatMessageText | ChatMessageImage,
  ): Promise<void>;
  setRenderMode(mode: ETranscriptRenderMode): void;
  destroy(): void;
}

const DEFAULT_TOOLKIT_PROVIDER: ToolkitProvider = {
  init: (config) => AgoraVoiceAI.init(config),
};

function toAppAgentState(state: string): EAgentState | null {
  return Object.values(AppAgentState).includes(state as AppAgentState)
    ? (state as EAgentState)
    : null;
}

export async function startAgoraClientToolkit(
  options: StartAgoraClientToolkitOptions,
  provider: ToolkitProvider = DEFAULT_TOOLKIT_PROVIDER,
): Promise<AgoraClientToolkitSession> {
  let latestHistory: ReadonlyArray<
    TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>
  > = [];
  let latestPts: number | null = null;
  let currentRenderMode = options.renderMode;
  let wordTimingState: WordTimingState =
    currentRenderMode === ETranscriptRenderMode.TEXT ? "disabled" : "waiting";
  let wordTimingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const emitTranscript = () => {
    options.onTranscript(
      normalizeToolkitTranscript(latestHistory, {
        localRtcUid: options.localRtcUid,
        pts: latestPts,
        useWordTiming: wordTimingState === "active",
      }),
    );
  };
  const clearWordTimingFallback = () => {
    if (wordTimingFallbackTimer === null) return;
    clearTimeout(wordTimingFallbackTimer);
    wordTimingFallbackTimer = null;
  };
  const scheduleWordTimingFallback = () => {
    if (wordTimingFallbackTimer !== null) return;
    wordTimingFallbackTimer = setTimeout(() => {
      wordTimingFallbackTimer = null;
      if (wordTimingState !== "waiting") return;
      wordTimingState = "fallback";
      emitTranscript();
    }, WORD_TIMING_FALLBACK_MS);
  };
  const configureRenderMode = (
    mode: ETranscriptRenderMode,
    preserveVisibleHistory: boolean,
  ) => {
    currentRenderMode = mode;
    clearWordTimingFallback();

    if (mode === ETranscriptRenderMode.TEXT) {
      wordTimingState = "disabled";
      if (latestHistory.length > 0) emitTranscript();
      return;
    }

    const agentItems = latestHistory.filter(
      (item) => metadataObject(item.metadata) === "assistant.transcription",
    );
    const hasAgentWords = agentItems.some(
      (item) => validTranscriptWords(item.metadata).length > 0,
    );

    if (agentItems.length > 0 && !hasAgentWords) {
      wordTimingState = "fallback";
    } else if (hasAgentWords && latestPts !== null) {
      wordTimingState = "active";
    } else {
      wordTimingState = "waiting";
      if (hasAgentWords) scheduleWordTimingFallback();
    }

    if (latestHistory.length > 0 && preserveVisibleHistory) emitTranscript();
  };
  const handleAudioPts = (pts: number) => {
    if (!Number.isFinite(pts) || pts <= 0 || (latestPts != null && pts <= latestPts)) {
      return;
    }
    latestPts = pts;
    if (wordTimingState === "waiting") {
      const agentItem = latestHistory.find(
        (item) => metadataObject(item.metadata) === "assistant.transcription",
      );
      if (agentItem && validTranscriptWords(agentItem.metadata).length > 0) {
        wordTimingState = "active";
        clearWordTimingFallback();
      }
    }
    if (wordTimingState === "active" && latestHistory.length > 0) {
      emitTranscript();
    }
  };

  options.rtcEngine.on("audio-pts", handleAudioPts);

  let client: ToolkitClient;
  try {
    client = await provider.init({
      rtcEngine: options.rtcEngine,
      ...(options.rtmEngine
        ? { rtmConfig: { rtmEngine: options.rtmEngine } }
        : {}),
      // Always ingest complete messages. The adapter applies WORD rendering
      // only when RTC provides a usable PTS clock, otherwise it keeps Agora's
      // documented TEXT fallback so completed agent turns cannot be stranded.
      renderMode: TranscriptHelperMode.TEXT,
      enableLog: options.enableLog ?? false,
    });
  } catch (error) {
    options.rtcEngine.off("audio-pts", handleAudioPts);
    throw error;
  }

  const handleTranscript: AgoraVoiceAIEventHandlers[AgoraVoiceAIEvents.TRANSCRIPT_UPDATED] =
    (history) => {
      latestHistory = history;
      if (wordTimingState === "waiting") {
        const firstAgentItem = history.find(
          (item) => metadataObject(item.metadata) === "assistant.transcription",
        );
        if (firstAgentItem) {
          const hasWords = validTranscriptWords(firstAgentItem.metadata).length > 0;
          if (!hasWords) {
            wordTimingState = "fallback";
            clearWordTimingFallback();
          } else if (latestPts !== null) {
            wordTimingState = "active";
            clearWordTimingFallback();
          } else {
            scheduleWordTimingFallback();
            return;
          }
        }
      }
      emitTranscript();
    };
  const handleAgentState: AgoraVoiceAIEventHandlers[AgoraVoiceAIEvents.AGENT_STATE_CHANGED] =
    (_agentUserId, event) => {
      const state = toAppAgentState(event.state);
      if (state) options.onAgentState(state);
    };

  client.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, handleTranscript);
  client.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, handleAgentState);
  client.subscribeMessage(options.channelId);

  let destroyed = false;

  return {
    chat: (agentUserId, message) => client.chat(agentUserId, message),
    setRenderMode: (mode) => {
      if (destroyed || mode === currentRenderMode) return;
      configureRenderMode(mode, true);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      clearWordTimingFallback();
      client.off(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, handleTranscript);
      client.off(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, handleAgentState);
      options.rtcEngine.off("audio-pts", handleAudioPts);
      client.unsubscribe();
      client.destroy();
    },
  };
}
