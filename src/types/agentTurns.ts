/** Saved when the user successfully starts an agent (for turns API after session ends). */
export interface AgentSessionRecord {
  agentId: string;
  joinedAt: number;
  channelId?: string;
  meetingName?: string;
}

/** Agora GET .../agents/{agentId}/turns response (v2.5+). */

export type TurnStartType =
  | "voice_input"
  | "greeting"
  | "silence_timeout"
  | "api_speak";

export type TurnEndType = "ok" | "interrupted" | "ignored" | "error";

export interface TurnEvent {
  start_at?: number;
  end_at?: number;
  type?: TurnStartType | TurnEndType | string;
  metadata?: Record<string, unknown>;
}

export interface ConversationTurnSegmentMetric {
  name: string;
  latency: number;
}

export interface ConversationTurnMetrics {
  e2e_latency_ms?: number;
  segmented_latency_ms?: ConversationTurnSegmentMetric[];
}

export interface ConversationTurn {
  agent_id?: string;
  channel?: string;
  turn_id: number;
  start?: TurnEvent;
  end?: TurnEvent;
  metrics?: ConversationTurnMetrics;
}

export interface AgentTurnsResponse {
  turns: ConversationTurn[];
}
