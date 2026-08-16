import { create } from "zustand";
import type {
  ILocalAudioTrack,
  ILocalVideoTrack,
  IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";
import type {
  AgentQueryStatus,
  AgentSettings,
  ITranscriptHelperItem,
  ThinkOptions,
} from "@/types/agora";
import { EAgentState, ETranscriptRenderMode } from "@/types/agora";
import type { AgentSessionRecord } from "@/types/agentTurns";
import type {
  AgentErrorEvent,
  AgentMetricEvent,
  ManualTurnResult,
  MessageErrorEvent,
} from "@/lib/agora/clientToolkitAdapter";
import {
  getTranscriptTransport,
  withTranscriptTransport,
} from "@/lib/agora/transcriptTransport";
import {
  loadAgentSessionHistory,
  MAX_AGENT_SESSION_RECORDS,
  saveAgentSessionHistory,
} from "@/utils/agentSessionHistoryStorage";

type Theme = "light" | "dark";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface InstructionLogEntry {
  id: string;
  text: string;
  options: Pick<
    ThinkOptions,
    | "on_listening_action"
    | "on_thinking_action"
    | "on_speaking_action"
    | "interruptable"
    | "metadata"
    | "label"
  >;
  status: "pending" | "sent" | "error";
  errorMessage?: string;
  _time: number;
}

interface CallStartPayload {
  displayName: string;
  rtcUid: string;
  channelName: string;
  startedAt: number;
}

interface AppState {
  videoMuted: boolean;
  audioMuted: boolean;
  callActive: boolean;
  localUsername: string;
  localUID: string | null;
  channelId: string;
  sessionStartTime: number | null;
  localAudioTrack: ILocalAudioTrack | null;
  localVideoTrack: ILocalVideoTrack | null;
  selectedMicrophoneId: string | null;

  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleVideoMute: () => void;
  toggleAudioMute: () => void;
  setLocalTracks: (
    audioTrack: ILocalAudioTrack | null,
    videoTrack: ILocalVideoTrack | null,
  ) => void;
  setSelectedMicrophoneId: (id: string | null) => void;
  callStart: (payload: CallStartPayload) => void;
  callEnd: () => void;

  agentId: string | null;
  isAgentActive: boolean;
  isAgentLoading: boolean;
  isAgentUpdating: boolean;
  agentSettings: AgentSettings | null;
  agentState: EAgentState;
  agentListening: boolean;
  agentThinking: boolean;
  agentSpeaking: boolean;
  agentRtcUid: string | null;
  agentAvatarRtcUid: string | null;
  agentAvatarVideoTrack: IRemoteVideoTrack | null;
  transcriptItems: ITranscriptHelperItem[];
  currentInProgressMessage: ITranscriptHelperItem | null;
  userSentMessages: { text?: string; imageUrl?: string; _time: number }[];
  transcriptionMode: "rtc" | "rtm";
  transcriptRenderMode: ETranscriptRenderMode;
  agentSessionHistory: AgentSessionRecord[];
  instructionLog: InstructionLogEntry[];
  agentQueryStatus: AgentQueryStatus | null;
  liveAgentMetrics: AgentMetricEvent[];
  liveAgentErrors: AgentErrorEvent[];
  liveMessageErrors: MessageErrorEvent[];
  manualTurnResults: ManualTurnResult[];

  setAgentActive: (
    agentId: string,
    agentRtcUid?: string,
    avatarRtcUid?: string,
  ) => void;
  appendAgentSession: (entry: AgentSessionRecord) => void;
  removeAgentSessionFromHistory: (agentId: string) => void;
  hydrateAgentSessionHistory: () => void;
  setAgentLoading: (loading: boolean) => void;
  setAgentUpdating: (updating: boolean) => void;
  clearAgent: () => void;
  setAgentSettings: (settings: AgentSettings) => void;
  setAgentState: (state: EAgentState) => void;
  setAgentAvatarVideoTrack: (track: IRemoteVideoTrack | null) => void;
  addInstructionLogEntry: (entry: InstructionLogEntry) => void;
  updateInstructionLogEntry: (
    id: string,
    patch: Partial<InstructionLogEntry>,
  ) => void;
  clearInstructionLog: () => void;
  setTranscriptItems: (items: ITranscriptHelperItem[]) => void;
  setCurrentInProgressMessage: (
    message: ITranscriptHelperItem | null,
  ) => void;
  addUserSentMessage: (payload: {
    text?: string;
    imageUrl?: string;
  }) => void;
  setTranscriptionMode: (mode: "rtc" | "rtm") => void;
  setTranscriptRenderMode: (mode: ETranscriptRenderMode) => void;
  setAgentQueryStatus: (status: AgentQueryStatus | null) => void;
  addLiveAgentMetric: (event: AgentMetricEvent) => void;
  addLiveAgentError: (event: AgentErrorEvent) => void;
  addLiveMessageError: (event: MessageErrorEvent) => void;
  addManualTurnResult: (event: ManualTurnResult) => void;

  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const INITIAL_AGENT_STATE = {
  agentId: null,
  isAgentActive: false,
  isAgentLoading: false,
  isAgentUpdating: false,
  agentState: EAgentState.IDLE,
  agentListening: false,
  agentThinking: false,
  agentSpeaking: false,
  agentRtcUid: null,
  agentAvatarRtcUid: null,
  agentAvatarVideoTrack: null,
  transcriptItems: [],
  currentInProgressMessage: null,
  userSentMessages: [],
  instructionLog: [],
  transcriptionMode: "rtm" as const,
  agentQueryStatus: null,
  liveAgentMetrics: [],
  liveAgentErrors: [],
  liveMessageErrors: [],
  manualTurnResults: [],
};

const useAppStore = create<AppState>((set) => ({
  videoMuted: false,
  audioMuted: false,
  callActive: false,
  localUsername: "",
  localUID: null,
  channelId: "",
  sessionStartTime: null,
  localAudioTrack: null,
  localVideoTrack: null,
  selectedMicrophoneId: null,
  theme: "dark",

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
  setTheme: (theme) => set({ theme }),
  toggleVideoMute: () =>
    set((state) => ({ videoMuted: !state.videoMuted })),
  toggleAudioMute: () =>
    set((state) => ({ audioMuted: !state.audioMuted })),
  setLocalTracks: (localAudioTrack, localVideoTrack) =>
    set({ localAudioTrack, localVideoTrack }),
  setSelectedMicrophoneId: (selectedMicrophoneId) =>
    set({ selectedMicrophoneId }),
  callStart: ({ displayName, rtcUid, channelName, startedAt }) =>
    set({
      callActive: true,
      localUsername: displayName,
      localUID: rtcUid,
      channelId: channelName,
      sessionStartTime: startedAt,
    }),
  callEnd: () =>
    set({
      callActive: false,
      localUsername: "",
      localUID: null,
      channelId: "",
      sessionStartTime: null,
      localAudioTrack: null,
      localVideoTrack: null,
      videoMuted: false,
      audioMuted: false,
      ...INITIAL_AGENT_STATE,
    }),

  ...INITIAL_AGENT_STATE,
  agentSettings: null,
  transcriptRenderMode: ETranscriptRenderMode.AUTO,
  agentSessionHistory: [],

  setAgentActive: (agentId, agentRtcUid, avatarRtcUid) =>
    set({
      agentId,
      agentRtcUid: agentRtcUid || null,
      agentAvatarRtcUid: avatarRtcUid ?? null,
      isAgentActive: true,
      isAgentLoading: false,
    }),
  appendAgentSession: (entry) =>
    set((state) => {
      const existing =
        state.agentSessionHistory.length > 0
          ? state.agentSessionHistory
          : typeof window !== "undefined"
            ? loadAgentSessionHistory()
            : [];
      const agentSessionHistory = [
        entry,
        ...existing.filter((item) => item.agentId !== entry.agentId),
      ].slice(0, MAX_AGENT_SESSION_RECORDS);
      saveAgentSessionHistory(agentSessionHistory);
      return { agentSessionHistory };
    }),
  removeAgentSessionFromHistory: (agentId) =>
    set((state) => {
      const agentSessionHistory = state.agentSessionHistory.filter(
        (item) => item.agentId !== agentId,
      );
      saveAgentSessionHistory(agentSessionHistory);
      return { agentSessionHistory };
    }),
  hydrateAgentSessionHistory: () =>
    set({ agentSessionHistory: loadAgentSessionHistory() }),
  setAgentLoading: (isAgentLoading) => set({ isAgentLoading }),
  setAgentUpdating: (isAgentUpdating) => set({ isAgentUpdating }),
  clearAgent: () => set(INITIAL_AGENT_STATE),
  setAgentSettings: (agentSettings) => {
    const normalizedSettings = withTranscriptTransport(agentSettings);
    set((state) => ({
      agentSettings: normalizedSettings,
      transcriptionMode: state.isAgentActive
        ? state.transcriptionMode
        : getTranscriptTransport(normalizedSettings),
    }));
  },
  setAgentState: (agentState) =>
    set({
      agentState,
      agentListening: agentState === EAgentState.LISTENING,
      agentThinking: agentState === EAgentState.THINKING,
      agentSpeaking: agentState === EAgentState.SPEAKING,
    }),
  setAgentAvatarVideoTrack: (agentAvatarVideoTrack) =>
    set({ agentAvatarVideoTrack }),
  addInstructionLogEntry: (entry) =>
    set((state) => ({ instructionLog: [...state.instructionLog, entry] })),
  updateInstructionLogEntry: (id, patch) =>
    set((state) => ({
      instructionLog: state.instructionLog.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    })),
  clearInstructionLog: () => set({ instructionLog: [] }),
  setTranscriptItems: (transcriptItems) => set({ transcriptItems }),
  setCurrentInProgressMessage: (currentInProgressMessage) =>
    set({ currentInProgressMessage }),
  addUserSentMessage: (payload) =>
    set((state) => ({
      userSentMessages: [
        ...state.userSentMessages,
        { ...payload, _time: Date.now() },
      ],
    })),
  setTranscriptionMode: (transcriptionMode) => set({ transcriptionMode }),
  setTranscriptRenderMode: (transcriptRenderMode) =>
    set({ transcriptRenderMode }),
  setAgentQueryStatus: (agentQueryStatus) => set({ agentQueryStatus }),
  addLiveAgentMetric: (event) =>
    set((state) => ({
      liveAgentMetrics: [...state.liveAgentMetrics, event].slice(-100),
    })),
  addLiveAgentError: (event) =>
    set((state) => ({
      liveAgentErrors: [...state.liveAgentErrors, event].slice(-100),
    })),
  addLiveMessageError: (event) =>
    set((state) => ({
      liveMessageErrors: [...state.liveMessageErrors, event].slice(-100),
    })),
  addManualTurnResult: (event) =>
    set((state) => ({
      manualTurnResults: [...state.manualTurnResults, event].slice(-100),
    })),

  toasts: [],
  addToast: (message, type) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          message,
          type,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));

if (typeof document !== "undefined") {
  document.documentElement.classList.add(useAppStore.getState().theme);
}

export default useAppStore;
