import { afterEach, describe, expect, it, vi } from "vitest";
import { queryAgentTurns } from "./agentApi";

afterEach(() => vi.restoreAllMocks());

describe("queryAgentTurns", () => {
  it("requests a specific page and returns current response metadata", async () => {
    const response = {
      agent_id: "agent-1",
      name: "agent-name",
      channel: "channel-a",
      total_turn_count: 73,
      pagination: { cursor: "next-1", next_cursor: "next-2", limit: 25 },
      turns: [],
    };
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json(response));

    const result = await queryAgentTurns("agent-1", {
      cursor: "next-1",
      limit: 25,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/agent/turns?agentId=agent-1&cursor=next-1&limit=25",
    );
    expect(result.total_turn_count).toBe(73);
    expect(result.pagination?.next_cursor).toBe("next-2");
  });
});
