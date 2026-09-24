import { NextRequest, NextResponse } from "next/server";
import type { ThinkOptions } from "@/types/agora";
import { buildAgoraProjectApiUrl } from "@/lib/agora/apiBaseUrl";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID!;
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET!;

/**
 * Send a custom instruction to a running Conversational AI agent (v2.6).
 *
 * Proxies POST https://api.agora.io/api/conversational-ai-agent/v2/projects/
 *   {appid}/agents/{agentId}/think
 *
 * See: https://docs.agora.io/en/conversational-ai/rest-api/agent/think
 */
type ThinkRequestBody = {
  agentId: string;
  options: ThinkOptions;
  apiBaseUrl?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ThinkRequestBody;
    const { agentId, options, apiBaseUrl } = body ?? ({} as ThinkRequestBody);

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 },
      );
    }
    if (!options || typeof options.text !== "string" || options.text.trim() === "") {
      return NextResponse.json(
        { error: "options.text is required" },
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

    const payload: Record<string, unknown> = {
      text: options.text.trim(),
      on_listening_action: options.on_listening_action ?? "interrupt",
      on_thinking_action: options.on_thinking_action ?? "interrupt",
      on_speaking_action: options.on_speaking_action ?? "ignore",
      interruptable: options.interruptable ?? true,
    };
    if (options.metadata && Object.keys(options.metadata).length > 0)
      payload.metadata = options.metadata;

    const authHeader = Buffer.from(
      `${CUSTOMER_ID}:${CUSTOMER_SECRET}`,
    ).toString("base64");
    const apiUrl = buildAgoraProjectApiUrl(
      apiBaseUrl,
      APP_ID,
      `/agents/${encodeURIComponent(agentId)}/think`,
    );

    if (
      process.env.AGORA_LOG_PAYLOAD_VERBOSE === "1" ||
      process.env.AGORA_LOG_PAYLOAD_VERBOSE === "true"
    ) {
      console.log(
        "[Agent think] POST",
        apiUrl,
        JSON.stringify(payload, null, 2),
      );
    }

    const agoraResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok) {
      console.error("Agora /think failed:", agoraResponse.status, responseData);
      return NextResponse.json(
        { error: "Failed to send instruction", details: responseData },
        { status: agoraResponse.status },
      );
    }

    return NextResponse.json({
      agent_id: responseData.agent_id,
      channel: responseData.channel,
      start_ts: responseData.start_ts,
    });
  } catch (error) {
    console.error("Agent think error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
