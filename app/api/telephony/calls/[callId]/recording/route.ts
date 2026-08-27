import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildTelephonyAuthorization,
  readTelephonyConfig,
} from "@/server/telephonyConfig";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  for (const field of ["detail", "message", "error"]) {
    if (typeof payload[field] === "string" && payload[field].trim()) {
      return payload[field].trim();
    }
  }
  return fallback;
}

function recordingExtension(url: URL): string {
  const match = url.pathname.match(/\.([a-zA-Z0-9]{1,5})$/);
  return match?.[1]?.toLowerCase() ?? "audio";
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { callId } = await context.params;
    const config = readTelephonyConfig();
    const detailResponse = await fetch(
      `${config.baseUrl}/v2/calls/${encodeURIComponent(callId)}?source_system=external`,
      {
        headers: { Authorization: buildTelephonyAuthorization(config) },
        cache: "no-store",
      },
    );
    const detailPayload = (await detailResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!detailResponse.ok) {
      return NextResponse.json(
        { error: errorMessage(detailPayload, "Unable to load call recording") },
        { status: detailResponse.status },
      );
    }

    const data =
      typeof detailPayload.data === "object" && detailPayload.data !== null
        ? (detailPayload.data as Record<string, unknown>)
        : detailPayload;
    const recordingUrlValue = data.record_file_url;
    if (typeof recordingUrlValue !== "string" || !recordingUrlValue.trim()) {
      return NextResponse.json(
        { error: "Recording is not available yet" },
        { status: 404 },
      );
    }

    const recordingUrl = new URL(recordingUrlValue);
    if (recordingUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Recording URL is invalid" },
        { status: 502 },
      );
    }
    const range = request.headers.get("Range");
    const recordingResponse = await fetch(recordingUrl.toString(), {
      cache: "no-store",
      ...(range ? { headers: { Range: range } } : {}),
    });
    if (!recordingResponse.ok || !recordingResponse.body) {
      return NextResponse.json(
        { error: "Unable to download call recording" },
        { status: 502 },
      );
    }

    const disposition =
      new URL(request.url).searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Disposition": `${disposition}; filename="call-${callId}.${recordingExtension(recordingUrl)}"`,
      "Content-Type":
        recordingResponse.headers.get("Content-Type") ?? "application/octet-stream",
    });
    for (const name of ["Accept-Ranges", "Content-Length", "Content-Range"]) {
      const value = recordingResponse.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(recordingResponse.body, {
      status: recordingResponse.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to download call recording" },
      { status: 502 },
    );
  }
}
