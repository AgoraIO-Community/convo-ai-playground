import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { POST } from "./route";

interface TestSession {
  user?: { name?: string | null; email?: string | null };
  expires: string;
}

const mockedAuth = auth as unknown as {
  mockResolvedValue: (value: TestSession | null) => void;
};
const originalEnv = { ...process.env };

describe("POST /api/rtc/session", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGORA_APP_ID =
      "970CA35de60c44645bbae8a215061b33";
    process.env.AGORA_APP_CERTIFICATE =
      "5CFd2fd1755d40ecb72977518be15d3b";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });

  it("returns non-cacheable RTC and RTM credentials for the signed-in user", async () => {
    mockedAuth.mockResolvedValue({
      user: {
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
      expires: "2099-01-01T00:00:00.000Z",
    });

    const response = await POST();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      displayName: "Ada Lovelace",
      rtmUserId: String(body.rtcUid),
      expiresInSeconds: 3600,
    });
    expect(body.channelName).toMatch(/^channel-[0-9a-f-]{36}$/);
    expect(body.rtcToken).toEqual(expect.any(String));
    expect(body.rtmToken).toEqual(expect.any(String));
    expect(body).not.toHaveProperty("appCertificate");
    expect(body).not.toHaveProperty("customerSecret");
  });

  it("returns a safe error when server credentials are missing", async () => {
    mockedAuth.mockResolvedValue({
      user: { email: "ada@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    });
    delete process.env.AGORA_APP_CERTIFICATE;

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Agora is not configured on the server",
    });
  });
});
