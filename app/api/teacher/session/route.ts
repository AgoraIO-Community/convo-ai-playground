import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  closeTeacherSession,
  consumeTeacherRateLimit,
  createTeacherSession,
} from "@/server/teacher/sessionBroker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(): Promise<NextResponse> {
  const appSession = await auth();
  if (!appSession?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const identity =
    appSession.user.email ?? appSession.user.name ?? "authenticated-user";
  const bucket = createHash("sha256").update(identity).digest("hex");
  if (!(await consumeTeacherRateLimit(`session:${bucket}`, 10, 60))) {
    return NextResponse.json(
      { error: "Too many teacher sessions. Try again shortly." },
      { status: 429 },
    );
  }
  return NextResponse.json(await createTeacherSession(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const appSession = await auth();
  if (!appSession?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const closed = await closeTeacherSession(sessionId, bearerToken(request));
  return NextResponse.json(
    { success: closed },
    {
      status: closed ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
