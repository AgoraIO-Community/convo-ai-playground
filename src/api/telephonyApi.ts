import type {
  OutboundCallRequest,
  OutboundCallResponse,
  OutboundCallStatus,
  TelephonyPublicConfig,
} from "@/types/telephony";

async function apiError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return new Error(payload.error || fallback);
}

export async function getTelephonyConfig(): Promise<TelephonyPublicConfig> {
  const response = await fetch("/api/telephony/config", { cache: "no-store" });
  if (!response.ok) throw await apiError(response, "Failed to load telephony configuration");
  return response.json() as Promise<TelephonyPublicConfig>;
}

export async function startOutboundCall(
  request: OutboundCallRequest,
): Promise<OutboundCallResponse> {
  const response = await fetch("/api/telephony/outbound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await apiError(response, "Failed to start outbound call");
  return response.json() as Promise<OutboundCallResponse>;
}

export async function getOutboundCallStatus(
  callId: string,
): Promise<OutboundCallStatus> {
  const response = await fetch(
    `/api/telephony/calls/${encodeURIComponent(callId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw await apiError(response, "Failed to load call status");
  return response.json() as Promise<OutboundCallStatus>;
}
