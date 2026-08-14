// src/api/agentApi.ts
import type {
  AgentSettings,
  AgentQueryStatus,
  ThinkOptions,
  ThinkResponse,
} from "@/types/agora";
import type { AgentTurnsResponse } from "@/types/agentTurns";

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
): Promise<AgentQueryStatus> {
  const response = await fetch(`/api/agent/query?agentId=${encodeURIComponent(agentId)}`);

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
): Promise<AgentTurnsResponse> {
  const response = await fetch(
    `/api/agent/turns?agentId=${encodeURIComponent(agentId)}`,
  );

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
 * Defaults match the Agora docs:
 *   on_listening_action: "inject"
 *   on_thinking_action: "interrupt"
 *   on_speaking_action: "ignore"
 *   interruptable: true
 *
 * See: https://docs.agora.io/en/conversational-ai/rest-api/agent/think
 */
export async function sendAgentInstruction(
  agentId: string,
  options: ThinkOptions,
): Promise<ThinkResponse> {
  const response = await fetch("/api/agent/think", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, options }),
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

/**
 * Stops the AI agent and removes it from the call.
 */
export async function stopAgent(
  agentId: string,
): Promise<{ success: boolean }> {
  const response = await fetch("/api/agent/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to stop agent");
  }

  return response.json();
}
