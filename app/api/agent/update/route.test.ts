import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AgentSettings } from "@/types/agora";

const originalEnv = { ...process.env };

describe("POST /api/agent/update", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGORA_APP_ID = "970CA35de60c44645bbae8a215061b33";
    process.env.AGORA_APP_CERTIFICATE = "5CFd2fd1755d40ecb72977518be15d3b";
    process.env.AGORA_CUSTOMER_ID = "customer-id";
    process.env.AGORA_CUSTOMER_SECRET = "customer-secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("updates MLLM params from mllm instead of llm", async () => {
    const settings: AgentSettings = {
      name: "agent-a",
      llm: {
        url: "https://llm.example.test",
        api_key: "",
        params: { model: "wrong-cascade-model" },
      },
      tts: { vendor: "openai", params: {} },
      mllm: {
        enable: true,
        vendor: "openai",
        params: { voice: "coral", model: "gpt-realtime" },
      },
      advanced_features: { enable_rtm: true },
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ agent_id: "agent-1", status: "RUNNING" }),
    );
    vi.resetModules();
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/agent/update", {
        method: "POST",
        body: JSON.stringify({
          agentId: "agent-1",
          channelName: "channel-a",
          agentSettings: settings,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(payload.properties.mllm).toEqual({
      params: { voice: "coral", model: "gpt-realtime" },
    });
    expect(payload.properties).not.toHaveProperty("llm");
  });
});
