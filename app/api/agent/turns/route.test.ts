import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = { ...process.env };

describe("GET /api/agent/turns", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGORA_APP_ID = "app-id";
    process.env.AGORA_CUSTOMER_ID = "customer-id";
    process.env.AGORA_CUSTOMER_SECRET = "customer-secret";
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("forwards cursor and limit and returns pagination metadata", async () => {
    const upstream = {
      agent_id: "agent-1",
      name: "agent-name",
      channel: "channel-a",
      total_turn_count: 73,
      pagination: { cursor: "next-1", next_cursor: "next-2", limit: 25 },
      turns: [],
    };
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json(upstream));
    vi.resetModules();
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/agent/turns?agentId=agent-1&cursor=next-1&limit=25",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.agora.io/api/conversational-ai-agent/v2/projects/app-id/agents/agent-1/turns?cursor=next-1&limit=25",
    );
    await expect(response.json()).resolves.toEqual(upstream);
  });

  it("rejects limits outside 1 through 100", async () => {
    vi.resetModules();
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/agent/turns?agentId=agent-1&limit=101",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "limit must be an integer between 1 and 100",
    });
  });
});
