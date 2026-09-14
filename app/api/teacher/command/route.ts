import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseTeacherDrawRequest } from "@/lib/teacher/commands";
import { publishTeacherCommand } from "@/server/teacher/sessionBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appSession = await auth();
  if (!appSession?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const token = bearerToken(request);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 422 });
  }

  const parsed = parseTeacherDrawRequest(input);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const event = await publishTeacherCommand(sessionId, token, parsed.value);
  if (!event) {
    return NextResponse.json(
      { error: "Unauthorized teacher session." },
      { status: 401 },
    );
  }

  return NextResponse.json(
    { eventId: event.eventId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
