import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AgentSettings } from "@/types/agora";

const originalEnv = { ...process.env };

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function legacySettings(): AgentSettings {
  return {
    name: "agent-a",
    llm: {
      url: "https://llm.example.test",
      api_key: "***MASKED***",
      params: { model: "model-a" },
    },
    tts: {
      vendor: "polly",
      params: { key: "***MASKED***", voice: "Joanna" },
    },
    asr: { vendor: "ares", params: {} },
    idle_timeout: 0,
    enable_turn_detection: true,
    turn_detection: {
      mode: "default",
      config: {
        start_of_speech: {
          mode: "disabled",
          disabled_config: { strategy: "ignored" },
        },
      },
    },
    advanced_features: { enable_rtm: false, enable_mllm: false },
    parameters: {
      data_channel: "rtc",
      enable_farewell: true,
      enable_metrics: true,
    },
  };
}

async function loadPost() {
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/agent/invite", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGORA_APP_ID = "970CA35de60c44645bbae8a215061b33";
    process.env.AGORA_APP_CERTIFICATE = "5CFd2fd1755d40ecb72977518be15d3b";
    process.env.AGORA_CUSTOMER_ID = "customer-id";
    process.env.AGORA_CUSTOMER_SECRET = "customer-secret";
    process.env.LLM_API_KEY = "server-llm-key";
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sends one normalized v2.11 payload with server credentials", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ agent_id: "agent-id", status: "RUNNING" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const POST = await loadPost();

    const response = await POST(
      request({
        channelName: "channel-a",
        uid: "42",
        username: "Ada",
        agentSettings: legacySettings(),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    const payload = JSON.parse(String(options?.body)) as {
      name: string;
      properties: Record<string, unknown>;
    };
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(payload.name).toBe("agent-a");
    expect(payload.properties).toMatchObject({
      agent_rtc_uid: "0",
      remote_rtc_uids: ["*"],
      idle_timeout: 0,
      llm: { api_key: "server-llm-key" },
      tts: { vendor: "amazon", params: { voice: "Joanna" } },
      interruption: {
        enable: false,
        disabled_config: { strategy: "ignore" },
      },
      parameters: {
        data_channel: "datastream",
        enable_metrics: true,
        farewell_config: { graceful_enabled: true },
      },
    });
    expect(payload.properties.advanced_features).not.toHaveProperty(
      "enable_mllm",
    );
    expect(
      (payload.properties.turn_detection as { config?: object } | undefined)
        ?.config,
    ).not.toHaveProperty("start_of_speech");
  });

  it("preserves Agora reason and detail for rate limiting", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ reason: "TooManyRequests", detail: "Try later" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    const POST = await loadPost();

    const response = await POST(
      request({ channelName: "channel-a", uid: "42", agentSettings: legacySettings() }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to start AI agent",
      reason: "TooManyRequests",
      detail: "Try later",
    });
  });

  it("preserves valid managed LLM, greeting controls, generic TTS, and BYOK ARES keywords", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ agent_id: "agent-id", status: "RUNNING" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const POST = await loadPost();
    const current = legacySettings();
    current.llm = {
      credential_mode: "managed",
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      params: { model: "gpt-4.1-mini" },
      greeting_message: "Welcome",
      greeting_audio_url: "https://cdn.example.test/greeting.pcm",
      greeting_configs: {
        mode: "single_first",
        delay_ms: 250,
        interruptable: false,
        audio_download_timeout_ms: 3000,
        audio_pcm_sample_rate: 24000,
      },
    };
    current.tts = {
      credential_mode: "byok",
      vendor: "generic_http",
      url: "https://tts.example.test/v1/audio/speech",
      headers: { Authorization: "Bearer custom" },
      params: { voice: "voice-a" },
      skip_patterns: [1, 2],
    };
    current.asr = {
      credential_mode: "byok",
      vendor: "ares",
      language: "en-US",
      keywords: ["Agora"],
      params: {},
    };
    current.pipeline_id = "pipeline-211";
    current.geofence = { area: "GLOBAL", exclude_area: "EUROPE" };

    const response = await POST(
      request({
        channelName: "channel-a",
        uid: "42",
        username: "Ada",
        agentSettings: current,
      }),
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(payload.pipeline_id).toBe("pipeline-211");
    expect(payload.properties).toMatchObject({
      geofence: { area: "GLOBAL", exclude_area: "EUROPE" },
      llm: {
        credential_mode: "managed",
        api_key: "",
        greeting_audio_url: "https://cdn.example.test/greeting.pcm",
        greeting_configs: {
          mode: "single_first",
          delay_ms: 250,
          interruptable: false,
          audio_download_timeout_ms: 3000,
          audio_pcm_sample_rate: 24000,
        },
      },
      tts: {
        vendor: "generic_http",
        url: "https://tts.example.test/v1/audio/speech",
        headers: { Authorization: "Bearer custom" },
        params: { voice: "voice-a" },
        skip_patterns: [1, 2],
      },
      asr: {
        credential_mode: "byok",
        vendor: "ares",
        keywords: ["Agora"],
      },
    });
    expect(payload.properties.tts.params).not.toHaveProperty("key");
  });

  it("retries once with a fresh name after an Agora 409 collision", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reason: "AgentAlreadyExists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agent_id: "agent-id", status: "RUNNING" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const POST = await loadPost();

    const response = await POST(
      request({ channelName: "channel-a", uid: "42", agentSettings: legacySettings() }),
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const retryPayload = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(firstPayload.name).toBe("agent-a");
    expect(retryPayload.name).toMatch(/^agent-a-[0-9a-f-]{36}$/);
  });
});
