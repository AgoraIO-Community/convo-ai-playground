// Re-export types from main types file
export type {
  EAgentState,
  ETurnStatus,
  ITranscriptHelperItem,
  IUserTranscription,
  IAgentTranscription,
} from "@/types/agora";

// Additional types for Conversational AI API
export enum EConversationalAIAPIEvents {
  AGENT_STATE_CHANGED = "agent-state-changed",
  AGENT_INTERRUPTED = "agent-interrupted",
  AGENT_METRICS = "agent-metrics",
  AGENT_ERROR = "agent-error",
  TRANSCRIPT_UPDATED = "transcript-updated",
  DEBUG_LOG = "debug-log",
  MESSAGE_RECEIPT_UPDATED = "message-receipt-updated",
  MESSAGE_ERROR = "message-error",
  MESSAGE_SAL_STATUS = "message-sal-status",
}

export enum EMessageType {
  USER_TRANSCRIPTION = "user.transcription",
  AGENT_TRANSCRIPTION = "assistant.transcription",
  MSG_INTERRUPTED = "message.interrupt",
  MSG_METRICS = "message.metrics",
  MSG_ERROR = "message.error",
  IMAGE_UPLOAD = "image.upload",
  MESSAGE_INFO = "message.info",
  MESSAGE_SAL_STATUS = "message.sal_status",
}

export enum EModuleType {
  LLM = "llm",
  MLLM = "mllm",
  TTS = "tts",
  CONTEXT = "context",
  UNKNOWN = "unknown",
}

export enum EChatMessageType {
  TEXT = "text",
  IMAGE = "image",
  UNKNOWN = "unknown",
}

export enum EChatMessagePriority {
  INTERRUPTED = "interrupted",
  APPEND = "append",
  IGNORE = "ignore",
}

export enum ETranscriptHelperMode {
  TEXT = "text",
  WORD = "word",
  CHUNK = "chunk",
  UNKNOWN = "unknown",
}

/** RTM event names for addEventListener (agora-rtm-sdk compatible) */
export enum ERTMEvents {
  MESSAGE = "message",
  PRESENCE = "presence",
  STATUS = "status",
}

/** RTC event names for transcript sync */
export enum ERTCEvents {
  STREAM_MESSAGE = "stream-message",
  AUDIO_PTS = "audio-pts",
}

export interface IChatMessageText {
  messageType: EChatMessageType.TEXT;
  priority?: EChatMessagePriority;
  responseInterruptable?: boolean;
  text?: string;
}

export interface IChatMessageImage {
  messageType: EChatMessageType.IMAGE;
  uuid: string;
  url?: string;
  base64?: string;
}

export interface IMessageInterrupt {
  object: EMessageType.MSG_INTERRUPTED;
  message_id: string;
  data_type: "message";
  turn_id: number;
  start_ms: number;
  send_ts: number;
}

export interface IMessageMetrics {
  object: EMessageType.MSG_METRICS;
  module: EModuleType;
  metric_name: string;
  turn_id: number;
  latency_ms: number;
  send_ts: number;
}

export interface IMessageError {
  object: EMessageType.MSG_ERROR;
  module: EModuleType;
  code: number;
  message: string;
  turn_id: number;
  send_ts: number;
  [x: string]: unknown;
}

export interface IMessageSalStatus {
  object: EMessageType.MESSAGE_SAL_STATUS;
  status: string;
  timestamp: number;
  data_type: string;
  message_id: string;
  send_ts: number;
}

export interface TStateChangeEvent {
  state: string; // EAgentState as string
  turnID: number;
  timestamp: number;
  reason: string;
}

export interface TAgentMetric {
  type: EModuleType;
  name: string;
  value: number;
  timestamp: number;
}

export interface TModuleError {
  type: EModuleType;
  code: number;
  message: string;
  timestamp: number;
}

export interface TMessageReceipt {
  moduleType: EModuleType;
  messageType: EChatMessageType;
  message: string;
  turnId: number;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
