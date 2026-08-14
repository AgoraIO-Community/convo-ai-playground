import type { RtcSessionResponse } from "@/types/rtcSession";

export async function createRtcSession(): Promise<RtcSessionResponse> {
  const response = await fetch("/api/rtc/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<RtcSessionResponse>;

  if (!response.ok) {
    throw new Error(body.error || "Failed to create Agora session");
  }

  return body as RtcSessionResponse;
}
