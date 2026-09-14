import { NextRequest, NextResponse } from "next/server";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID ?? "";
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET ?? "";

interface InterruptRequestBody {
  agentId?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as InterruptRequestBody;
    const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    if (!APP_ID || !CUSTOMER_ID || !CUSTOMER_SECRET) {
      return NextResponse.json(
        { error: "Server missing Agora credentials. Check environment variables." },
        { status: 500 },
      );
    }

    const authHeader = Buffer.from(
      `${CUSTOMER_ID}:${CUSTOMER_SECRET}`,
    ).toString("base64");
    const apiUrl =
      "https://api.agora.io/api/conversational-ai-agent/v2/projects/" +
      `${encodeURIComponent(APP_ID)}/agents/${encodeURIComponent(agentId)}/interrupt`;
    const agoraResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!agoraResponse.ok) {
      console.error("[agent-interrupt] Agora request failed", {
        status: agoraResponse.status,
        agentId: agentId.slice(0, 24),
      });
      return NextResponse.json(
        { error: "Failed to interrupt the agent." },
        { status: agoraResponse.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent-interrupt] unexpected failure", {
      category: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to interrupt the agent." },
      { status: 500 },
    );
  }
}
