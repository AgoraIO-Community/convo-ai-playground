import type { AgentSessionRecord } from "@/types/agentTurns";

const STORAGE_KEY = "my-agora-agent-sessions-v1";
export const MAX_AGENT_SESSION_RECORDS = 40;

function isRecord(x: unknown): x is AgentSessionRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.agentId === "string" &&
    o.agentId.length > 0 &&
    typeof o.joinedAt === "number"
  );
}

export function loadAgentSessionHistory(): AgentSessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).slice(0, MAX_AGENT_SESSION_RECORDS);
  } catch {
    return [];
  }
}

export function saveAgentSessionHistory(records: AgentSessionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_AGENT_SESSION_RECORDS)),
    );
  } catch {
    /* quota or private mode */
  }
}
