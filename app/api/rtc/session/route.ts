import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRtcSessionTokens } from "@/server/agoraTokens";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID?.trim() ?? "";
  const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim() ?? "";
  if (!appId || !appCertificate) {
    return NextResponse.json(
      { error: "Agora is not configured on the server" },
      { status: 500 },
    );
  }

  const displayName =
    session.user.name?.trim() ||
    session.user.email?.split("@")[0]?.trim() ||
    "User";

  try {
    const rtcSession = createRtcSessionTokens({
      appId,
      appCertificate,
      displayName,
    });

    return NextResponse.json(rtcSession, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to create Agora session:", error);
    return NextResponse.json(
      { error: "Failed to create Agora session" },
      { status: 500 },
    );
  }
}
