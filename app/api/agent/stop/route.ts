import { NextRequest, NextResponse } from "next/server";
import { buildAgoraProjectApiUrl } from "@/lib/agora/apiBaseUrl";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID!;
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, apiBaseUrl } = body as {
      agentId?: string;
      apiBaseUrl?: string;
    };

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    if (!CUSTOMER_ID || !CUSTOMER_SECRET) {
      return NextResponse.json(
        { error: "Server missing Agora credentials. Check environment variables." },
        { status: 500 }
      );
    }

    const authHeader = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString("base64");

    const agoraResponse = await fetch(
      buildAgoraProjectApiUrl(
        apiBaseUrl,
        APP_ID,
        `/agents/${encodeURIComponent(agentId)}/leave`,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    if (!agoraResponse.ok) {
      const responseData = await agoraResponse.json();
      console.error("Agora Conversational AI leave failed:", responseData);
      return NextResponse.json(
        { error: "Failed to stop AI agent", details: responseData },
        { status: agoraResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Agent stop error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
