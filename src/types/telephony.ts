import type { AgentSettings } from "@/types/agora";

export interface OutboundCallOptions {
  enableRecording: boolean;
  maxDurationSeconds: number;
  maxSilenceDurationMs: number;
  maxRingDurationMs: number;
  idleTimeoutSeconds: number;
}

export interface OutboundCallRequest {
  toNumber: string;
  username: string;
  agentSettings: AgentSettings;
  options: OutboundCallOptions;
}

export interface OutboundCallResponse {
  callId: string;
  agentId?: string;
  agentSessionId?: string;
  status: string;
}

export type OutboundCallPhase = "dialing" | "live" | "completed" | "failed";

export interface OutboundCallTranscriptItem {
  role: string;
  content: string;
}

export interface OutboundCallStatus {
  callId: string;
  phase: OutboundCallPhase;
  agentSessionId?: string;
  fromNumber?: string;
  toNumber?: string;
  callCategory?: string;
  hangupReason?: string;
  durationSeconds?: number;
  answeredAt?: number;
  startedAt?: number;
  endedAt?: number;
  recordingUrl?: string;
  transcript?: OutboundCallTranscriptItem[];
  structuredOutput?: Array<Record<string, unknown>>;
}

export interface TelephonyPublicConfig {
  configured: boolean;
  phoneNumberId?: number;
}
