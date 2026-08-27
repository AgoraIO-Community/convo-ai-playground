import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildTelephonyAuthorization,
  readTelephonyConfig,
} from "@/server/telephonyConfig";
import type { OutboundCallPhase, OutboundCallStatus } from "@/types/telephony";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

const FAILED_CALL_CATEGORIES = new Set([
  "failed",
  "rejected",
  "outbound_transferred_failed",
  "transferred_failed",
  "ai_no_answer",
  "agent_no_answer",
  "no_answer",
  "unanswered",
  "voicemail",
]);

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function callPhase(data: Record<string, unknown>): OutboundCallPhase {
  if (data.end_ts !== null && data.end_ts !== undefined) {
    return FAILED_CALL_CATEGORIES.has(String(data.call_category ?? ""))
      ? "failed"
      : "completed";
  }
  return data.answered_ts !== null && data.answered_ts !== undefined
    ? "live"
    : "dialing";
}

function upstreamErrorMessage(payload: Record<string, unknown>): string {
  for (const field of ["detail", "message", "error"]) {
    if (typeof payload[field] === "string" && payload[field].trim()) {
      return payload[field].trim();
    }
  }
  return "Unable to load outbound call status";
}

function transcriptItems(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.role !== "string" || typeof record.content !== "string") {
      return [];
    }
    return [{ role: record.role, content: record.content }];
  });
}

function structuredOutputItems(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { callId } = await context.params;
  const config = readTelephonyConfig();
  const upstream = await fetch(
    `${config.baseUrl}/v2/calls/${encodeURIComponent(callId)}?source_system=external`,
    {
      headers: { Authorization: buildTelephonyAuthorization(config) },
      cache: "no-store",
    },
  );

  if (upstream.status === 404) {
    return NextResponse.json(
      { callId, phase: "dialing" } satisfies OutboundCallStatus,
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = (await upstream.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!upstream.ok) {
    return NextResponse.json(
      { error: upstreamErrorMessage(payload) },
      { status: upstream.status },
    );
  }

  const data =
    typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : payload;
  const body: OutboundCallStatus = {
    callId: optionalString(data.call_id) ?? callId,
    phase: callPhase(data),
    ...(optionalString(data.agent_session_id)
      ? { agentSessionId: optionalString(data.agent_session_id) }
      : {}),
    ...(optionalString(data.from_number)
      ? { fromNumber: optionalString(data.from_number) }
      : {}),
    ...(optionalString(data.to_number)
      ? { toNumber: optionalString(data.to_number) }
      : {}),
    ...(optionalString(data.call_category)
      ? { callCategory: optionalString(data.call_category) }
      : {}),
    ...(optionalString(data.hangup_reason)
      ? { hangupReason: optionalString(data.hangup_reason) }
      : {}),
    ...(optionalNumber(data.duration_seconds) !== undefined
      ? { durationSeconds: optionalNumber(data.duration_seconds) }
      : {}),
    ...(optionalNumber(data.answered_ts) !== undefined
      ? { answeredAt: optionalNumber(data.answered_ts) }
      : {}),
    ...(optionalNumber(data.start_ts) !== undefined
      ? { startedAt: optionalNumber(data.start_ts) }
      : {}),
    ...(optionalNumber(data.end_ts) !== undefined
      ? { endedAt: optionalNumber(data.end_ts) }
      : {}),
    ...(optionalString(data.record_file_url)
      ? { recordingUrl: optionalString(data.record_file_url) }
      : {}),
    ...(transcriptItems(data.transcript) !== undefined
      ? { transcript: transcriptItems(data.transcript) }
      : {}),
    ...(structuredOutputItems(data.structured_output) !== undefined
      ? { structuredOutput: structuredOutputItems(data.structured_output) }
      : {}),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
