import { NextRequest, NextResponse } from "next/server";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID ?? "";
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET ?? "";
const MAX_SPEECH_BYTES = 450;
const PRIORITIES = new Set(["INTERRUPT", "APPEND", "IGNORE"]);

interface SpeakRequestBody {
  agentId?: unknown;
  text?: unknown;
  priority?: unknown;
  interruptable?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SpeakRequestBody;
    const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
    const speech = typeof body.text === "string" ? body.text.trim() : "";
    const priority = body.priority ?? "APPEND";
    const interruptable = body.interruptable ?? true;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    if (!speech) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (new TextEncoder().encode(speech).byteLength > MAX_SPEECH_BYTES) {
      return NextResponse.json(
        { error: `text must be at most ${MAX_SPEECH_BYTES} UTF-8 bytes` },
        { status: 400 },
      );
    }
    if (typeof priority !== "string" || !PRIORITIES.has(priority)) {
      return NextResponse.json({ error: "priority is invalid" }, { status: 400 });
    }
    if (typeof interruptable !== "boolean") {
      return NextResponse.json(
        { error: "interruptable must be a boolean" },
        { status: 400 },
      );
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
      `${encodeURIComponent(APP_ID)}/agents/${encodeURIComponent(agentId)}/speak`;
    const agoraResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: speech,
        priority,
        interruptable,
      }),
    });
    const responseData = (await agoraResponse.json().catch(() => ({}))) as {
      agent_id?: string;
      channel?: string;
      start_ts?: number;
    };
    if (!agoraResponse.ok) {
      console.error("[agent-speak] Agora request failed", {
        status: agoraResponse.status,
        agentId: agentId.slice(0, 24),
      });
      return NextResponse.json(
        { error: "Failed to make the agent speak." },
        { status: agoraResponse.status },
      );
    }

    return NextResponse.json({
      agentId: responseData.agent_id ?? agentId,
      channel: responseData.channel ?? "",
      startTs: responseData.start_ts ?? Date.now(),
    });
  } catch (error) {
    console.error("[agent-speak] unexpected failure", {
      category: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to make the agent speak." },
      { status: 500 },
    );
  }
}
