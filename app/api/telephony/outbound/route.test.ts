import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AgentSettings } from "@/types/agora";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { POST } from "./route";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };

function settings(): AgentSettings {
  return {
    name: "outbound-agent",
    llm: {
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      params: { model: "gpt-4o-mini" },
    },
    tts: {
      vendor: "elevenlabs",
      params: { key: "", voice_id: "voice-id" },
    },
    asr: { vendor: "deepgram", params: { api_key: "", model: "nova-3" } },
  };
}

function request(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/telephony/outbound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toNumber: "+918800112233",
      username: "Bhupendra",
      agentSettings: settings(),
      options: {
        enableRecording: false,
        maxDurationSeconds: 300,
        maxSilenceDurationMs: 60000,
        maxRingDurationMs: 30000,
        idleTimeoutSeconds: 120,
      },
      ...overrides,
    }),
  });
}

describe("POST /api/telephony/outbound", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends the full audio pipeline to the production outbound endpoint", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    Object.assign(process.env, {
      AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
      AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
      NEXT_PUBLIC_AGORA_APP_ID: "app-id",
      AGORA_CUSTOMER_ID: "customer-id",
      AGORA_CUSTOMER_SECRET: "customer-secret",
      LLM_API_KEY: "llm-secret",
      ELEVENLABS_API_KEY: "tts-secret",
      DEEPGRAM_API_KEY: "asr-secret",
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    const fetchSpy = vi.mocked(global.fetch).mockResolvedValue(
      Response.json({
        code: 0,
        message: "success",
        data: {
          agent_session_id: "agent-session-123",
          status: "RUNNING",
        },
      }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "https://api.agora.io/conversational-ai/v2/outbound-dial/app-id",
    );
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from("customer-id:customer-secret").toString("base64")}`,
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      phone_num_id: 851,
      to_number: "+918800112233",
      call_id: "123e4567-e89b-42d3-a456-426614174000",
      max_duration_seconds: 300,
      max_silence_duration_ms: 60000,
      max_ring_duration_ms: 30000,
      idle_timeout: 120,
      enable_recording: false,
      properties: {
        llm: { api_key: "llm-secret" },
        tts: { params: { key: "tts-secret" } },
        asr: { params: { api_key: "asr-secret" } },
      },
    });
    expect(body).not.toHaveProperty("pipeline_id");
    expect(body).not.toHaveProperty("external_agent_id");
    expect(body.properties).not.toHaveProperty("channel");
    expect(body.properties).not.toHaveProperty("token");
    await expect(response.json()).resolves.toEqual({
      callId: "123e4567-e89b-42d3-a456-426614174000",
      agentSessionId: "agent-session-123",
      status: "RUNNING",
    });
  });

  it.each([
    ["not E.164", { toNumber: "8800112233" }],
    ["duration out of range", { options: { enableRecording: false, maxDurationSeconds: 0, maxSilenceDurationMs: 60000, maxRingDurationMs: 30000, idleTimeoutSeconds: 120 } }],
  ])("rejects %s", async (_label, override) => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });

    const response = await POST(request(override));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a safe upstream error without leaking credentials", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    Object.assign(process.env, {
      AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
      AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
      NEXT_PUBLIC_AGORA_APP_ID: "app-id",
      AGORA_CUSTOMER_ID: "customer-id",
      AGORA_CUSTOMER_SECRET: "customer-secret",
    });
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ detail: "Invalid phone number" }, { status: 400 }),
    );

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid phone number" });
    expect(JSON.stringify(body)).not.toContain("customer-secret");
  });
});
