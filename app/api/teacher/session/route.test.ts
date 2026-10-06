import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { POST } from "./route";

const mockedAuth = auth as unknown as {
  mockResolvedValue: (value: {
    user: { email: string };
    expires: string;
  }) => void;
};
const originalEnv = { ...process.env };

describe("POST /api/teacher/session", () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue({
      user: { email: "teacher@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    });
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a safe retryable response when shared storage is unavailable", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ error: "upstream unavailable" }, { status: 503 }),
    );

    const response = await POST();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "AI Teacher storage is temporarily unavailable. Please retry.",
    });
  });
});
