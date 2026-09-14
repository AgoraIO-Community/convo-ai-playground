import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTeacherSessionEvents } from "@/server/teacher/sessionBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appSession = await auth();
  if (!appSession?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const parsedCursor = Number(
    request.nextUrl.searchParams.get("afterEventId") ?? "0",
  );
  const afterEventId =
    Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;
  const events = await getTeacherSessionEvents(
    sessionId,
    bearerToken(request),
    afterEventId,
  );
  if (!events) {
    return NextResponse.json(
      { error: "Unauthorized teacher session." },
      { status: 401 },
    );
  }

  return NextResponse.json(
    { events, heartbeat: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
