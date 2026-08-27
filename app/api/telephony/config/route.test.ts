import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "./route";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };

describe("GET /api/telephony/config", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });

  it("returns only the public phone-number configuration", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    Object.assign(process.env, {
      AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
      AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
      NEXT_PUBLIC_AGORA_APP_ID: "app-id",
      AGORA_CUSTOMER_ID: "customer-id",
      AGORA_CUSTOMER_SECRET: "customer-secret",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      configured: true,
      phoneNumberId: 851,
    });
  });

  it("reports an unconfigured server without exposing its reason", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    delete process.env.AGORA_TELEPHONY_PHONE_NUMBER_ID;

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ configured: false });
  });
});
