import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildTelephonyAgentProperties } from "@/server/telephonyAgentProperties";
import {
  buildTelephonyAuthorization,
  readTelephonyConfig,
} from "@/server/telephonyConfig";
import { maskSensitive } from "@/server/maskSensitive";
import type {
  OutboundCallRequest,
  OutboundCallResponse,
} from "@/types/telephony";

const E164_NUMBER = /^\+[1-9]\d{7,14}$/;

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function validateRequest(body: Partial<OutboundCallRequest>): string | null {
  if (!E164_NUMBER.test(String(body.toNumber ?? ""))) {
    return "Destination number must use E.164 format";
  }
  if (!body.agentSettings || typeof body.agentSettings !== "object") {
    return "Agent settings are required";
  }
  if (!body.options || typeof body.options !== "object") {
    return "Call options are required";
  }
  if (!isIntegerInRange(body.options.maxDurationSeconds, 1, 3600)) {
    return "Maximum duration must be between 1 and 3600 seconds";
  }
  if (!isIntegerInRange(body.options.maxSilenceDurationMs, 1000, 300000)) {
    return "Maximum silence must be between 1000 and 300000 milliseconds";
  }
  if (!isIntegerInRange(body.options.maxRingDurationMs, 1000, 120000)) {
    return "Maximum ring duration must be between 1000 and 120000 milliseconds";
  }
  if (!isIntegerInRange(body.options.idleTimeoutSeconds, 1, 3600)) {
    return "Idle timeout must be between 1 and 3600 seconds";
  }
  if (typeof body.options.enableRecording !== "boolean") {
    return "Recording option must be a boolean";
  }
  return null;
}

function upstreamErrorMessage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "Agora could not start the outbound call";
  }
  const record = payload as Record<string, unknown>;
  for (const field of ["detail", "message", "error"]) {
    if (typeof record[field] === "string" && record[field].trim()) {
      return record[field].trim();
    }
  }
  return "Agora could not start the outbound call";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let input: Partial<OutboundCallRequest>;
  try {
    input = (await request.json()) as Partial<OutboundCallRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
  }

  const validationError = validateRequest(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const config = readTelephonyConfig();
    const callId = crypto.randomUUID();
    const options = input.options!;
    const properties = buildTelephonyAgentProperties({
      settings: input.agentSettings!,
      username: String(input.username ?? session.user.name ?? "Guest"),
    });
    const payload = {
      phone_num_id: config.phoneNumberId,
      to_number: input.toNumber,
      call_id: callId,
      max_duration_seconds: options.maxDurationSeconds,
      max_silence_duration_ms: options.maxSilenceDurationMs,
      max_ring_duration_ms: options.maxRingDurationMs,
      idle_timeout: options.idleTimeoutSeconds,
      enable_recording: options.enableRecording,
      properties,
    };
    const url = `${config.baseUrl}/v2/outbound-dial/${config.appId}`;

    console.log("[Telephony outbound] Request", maskSensitive({ url, payload }));
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildTelephonyAuthorization(config),
      },
      body: JSON.stringify(payload),
    });
    const responsePayload = (await upstream.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    console.log(
      "[Telephony outbound] Response",
      maskSensitive({ status: upstream.status, payload: responsePayload }),
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: upstreamErrorMessage(responsePayload) },
        { status: upstream.status },
      );
    }

    const data =
      typeof responsePayload.data === "object" && responsePayload.data !== null
        ? (responsePayload.data as Record<string, unknown>)
        : responsePayload;
    const body: OutboundCallResponse = {
      callId: String(data.call_id ?? callId),
      ...(data.agent_id ? { agentId: String(data.agent_id) } : {}),
      ...(data.agent_session_id
        ? { agentSessionId: String(data.agent_session_id) }
        : {}),
      status: String(data.status ?? "started"),
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[Telephony outbound] Failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    const configurationError =
      error instanceof Error &&
      (error.message.startsWith("Missing ") ||
        error.message.includes("AGENT_STUDIO_V2_BASE_URL") ||
        error.message.includes("AGORA_TELEPHONY_PHONE_NUMBER_ID"));
    return NextResponse.json(
      {
        error: configurationError
          ? "Outbound telephony is not configured on the server"
          : "Unable to start the outbound call",
      },
      { status: configurationError ? 503 : 502 },
    );
  }
}
