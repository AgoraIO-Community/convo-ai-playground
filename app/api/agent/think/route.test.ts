import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = { ...process.env };

describe("POST /api/agent/think", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGORA_APP_ID = "app-id";
    process.env.AGORA_CUSTOMER_ID = "customer-id";
    process.env.AGORA_CUSTOMER_SECRET = "customer-secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sends explicit v2.11 actions instead of relying on engine defaults", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ agent_id: "agent-1", channel: "channel-a", start_ts: 1 }),
    );
    vi.resetModules();
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/agent/think", {
        method: "POST",
        body: JSON.stringify({ agentId: "agent-1", options: { text: "recap" } }),
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      text: "recap",
      on_listening_action: "interrupt",
      on_thinking_action: "interrupt",
      on_speaking_action: "ignore",
      interruptable: true,
    });
  });
});
