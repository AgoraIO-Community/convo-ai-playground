import { NextRequest, NextResponse } from "next/server";
import { buildAgoraProjectApiUrl } from "@/lib/agora/apiBaseUrl";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID!;
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const apiBaseUrl = request.nextUrl.searchParams.get("apiBaseUrl") ?? undefined;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId query parameter is required" },
        { status: 400 },
      );
    }
    const limit = rawLimit == null ? undefined : Number(rawLimit);
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100)
    ) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 },
      );
    }

    if (!CUSTOMER_ID || !CUSTOMER_SECRET) {
      return NextResponse.json(
        {
          error:
            "Server missing Agora credentials. Check environment variables.",
        },
        { status: 500 },
      );
    }

    const authHeader = Buffer.from(
      `${CUSTOMER_ID}:${CUSTOMER_SECRET}`,
    ).toString("base64");

    const agoraTurnsUrl = new URL(
      buildAgoraProjectApiUrl(
        apiBaseUrl,
        APP_ID,
        `/agents/${encodeURIComponent(agentId)}/turns`,
      ),
    );
    if (cursor) agoraTurnsUrl.searchParams.set("cursor", cursor);
    if (limit !== undefined) agoraTurnsUrl.searchParams.set("limit", String(limit));
    console.log("[Agent turns] Agora Conversational AI GET:", agoraTurnsUrl.toString());

    const agoraResponse = await fetch(agoraTurnsUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    const responseData: unknown = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok) {
      console.error(
        "[Agent turns] Agora error",
        agoraResponse.status,
        "body:",
        responseData,
      );
      const is404 = agoraResponse.status === 404;
      const reason =
        responseData &&
        typeof responseData === "object" &&
        "reason" in responseData
          ? String((responseData as { reason?: unknown }).reason)
          : "";
      const taskNotFound = reason === "TaskNotFound";
      return NextResponse.json(
        {
          error: taskNotFound
            ? "Turn metrics are not ready yet (Agora: TaskNotFound). Query after the agent conversation has ended."
            : is404
              ? "Agora returned 404 for this agentId (no turn data or unknown agent for this App ID)."
              : "Failed to query conversation turns",
          hint: taskNotFound
            ? "Start the agent, complete the call, stop the agent, then try again. Past sessions: use Previous agents below. Docs: https://docs.agora.io/en/conversational-ai/rest-api/agent/turns"
            : is404
              ? "Confirm NEXT_PUBLIC_AGORA_APP_ID and AGORA_CUSTOMER_* match the project where the agent was started; data is kept 7 days."
              : undefined,
          upstream: "agora",
          upstreamStatus: agoraResponse.status,
          agoraReason: reason || undefined,
          details: responseData,
        },
        { status: agoraResponse.status },
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Agent turns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
