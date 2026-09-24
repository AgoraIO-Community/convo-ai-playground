// src/api/agentApi.ts
import type {
  AgentSettings,
  AgentQueryStatus,
  ThinkOptions,
  ThinkResponse,
} from "@/types/agora";
import type { AgentTurnsResponse } from "@/types/agentTurns";
import { toTeacherDrawWireRequest } from "@/lib/teacher/commands";
import type {
  TeacherDrawRequest,
  TeacherSessionCredentials,
} from "@/types/teacher";

export interface SpeakAgentInput {
  agentId: string;
  text: string;
  priority?: "INTERRUPT" | "APPEND" | "IGNORE";
  interruptable?: boolean;
}

export interface CustomJoinPayload {
  name: string;
  properties: Record<string, unknown>;
}

/**
 * Invites an AI agent to the current call via the server-side API route.
 * When useCustomPayload is true, sends customJoinPayload instead of agentSettings.
 */
export async function inviteAgent(
  channelName: string,
  uid: string,
  agentSettings: AgentSettings,
  options?: {
    useCustomPayload?: boolean;
    customJoinPayload?: CustomJoinPayload;
    /** User display name from create/join screen; sent as username for agent template_variables */
    username?: string;
    /** Ephemeral board credentials sent only with this agent invite. */
    teacherSession?: Pick<TeacherSessionCredentials, "sessionId" | "token">;
  },
): Promise<{
  agentId: string;
  status: string;
  agentRtcUid?: string;
  avatarRtcUid?: string;
}> {
  const body: Record<string, unknown> = {
    channelName,
    uid,
    agentSettings,
  };
  if (options?.useCustomPayload && options?.customJoinPayload) {
    body.useCustomPayload = true;
    body.customJoinPayload = options.customJoinPayload;
  }
  if (options?.username != null && options.username !== "") {
    body.username = options.username;
  }
  if (options?.teacherSession) {
    body.teacherSession = options.teacherSession;
  }

  const response = await fetch("/api/agent/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to invite agent");
  }

  return response.json();
}

/**
 * Updates agent configuration at runtime (LLM, token).
 * See: https://docs.agora.io/en/conversational-ai/rest-api/agent/update
 */
export async function updateAgent(
  agentId: string,
  channelName: string,
  agentSettings: AgentSettings,
): Promise<{ agentId: string; status: string }> {
  const response = await fetch("/api/agent/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      channelName,
      agentSettings,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update agent");
  }

  return response.json();
}

/**
 * Queries the current operational status of an AI agent.
 * See: https://docs.agora.io/en/conversational-ai/rest-api/agent/query
 */
export async function queryAgent(
  agentId: string,
  apiBaseUrl?: string,
): Promise<AgentQueryStatus> {
  const search = new URLSearchParams({ agentId });
  if (apiBaseUrl) search.set("apiBaseUrl", apiBaseUrl);
  const response = await fetch(`/api/agent/query?${search.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to query agent status");
  }

  return response.json();
}

/**
 * Per-turn latency and lifecycle metrics (after session ends; last 7 days).
 * See https://docs.agora.io/en/conversational-ai/rest-api/agent/turns
 */
export async function queryAgentTurns(
  agentId: string,
  options: { cursor?: string; limit?: number; apiBaseUrl?: string } = {},
): Promise<AgentTurnsResponse> {
  const search = new URLSearchParams({ agentId });
  if (options.cursor) search.set("cursor", options.cursor);
  if (options.limit !== undefined) search.set("limit", String(options.limit));
  if (options.apiBaseUrl) search.set("apiBaseUrl", options.apiBaseUrl);
  const response = await fetch(`/api/agent/turns?${search.toString()}`);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      hint?: string;
    };
    const msg = [errorData.error, errorData.hint].filter(Boolean).join(" ");
    throw new Error(msg || "Failed to query conversation turns");
  }

  return response.json() as Promise<AgentTurnsResponse>;
}

/**
 * Sends a custom text instruction to a running agent (v2.6).
 * Uses POST /v2/projects/{appid}/agents/{agentId}/think.
 *
 * Defaults are sent explicitly so future engine default changes do not alter behavior:
 *   on_listening_action: "interrupt"
 *   on_thinking_action: "interrupt"
 *   on_speaking_action: "ignore"
 *   interruptable: true
 *
 * See: https://docs.agora.io/en/conversational-ai/rest-api/agent/think
 */
export async function sendAgentInstruction(
  agentId: string,
  options: ThinkOptions,
  apiBaseUrl?: string,
): Promise<ThinkResponse> {
  const response = await fetch("/api/agent/think", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, options, apiBaseUrl }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: unknown;
    };
    throw new Error(errorData.error || "Failed to send agent instruction");
  }

  return response.json() as Promise<ThinkResponse>;
}

export async function speakAgent(input: SpeakAgentInput): Promise<void> {
  const response = await fetch("/api/agent/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || "Failed to make the agent speak");
  }
}

export async function interruptAgent(agentId: string): Promise<void> {
  const response = await fetch("/api/agent/interrupt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || "Failed to interrupt the agent");
  }
}

export async function publishTeacherCue(
  session: TeacherSessionCredentials,
  command: TeacherDrawRequest,
): Promise<{ eventId: number }> {
  const response = await fetch(
    `/api/teacher/command?sessionId=${encodeURIComponent(session.sessionId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toTeacherDrawWireRequest(command)),
    },
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || "Failed to update the teacher board");
  }

  return response.json() as Promise<{ eventId: number }>;
}

/**
 * Stops the AI agent and removes it from the call.
 */
export async function stopAgent(
  agentId: string,
  apiBaseUrl?: string,
): Promise<{ success: boolean }> {
  const response = await fetch("/api/agent/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, apiBaseUrl }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to stop agent");
  }

  return response.json();
}
