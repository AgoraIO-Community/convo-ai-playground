import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "./route";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };

const routeContext = {
  params: Promise.resolve({ callId: "123e4567-e89b-42d3-a456-426614174000" }),
};

function configureEnvironment() {
  Object.assign(process.env, {
    AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
    AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
    NEXT_PUBLIC_AGORA_APP_ID: "app-id",
    AGORA_CUSTOMER_ID: "customer-id",
    AGORA_CUSTOMER_SECRET: "customer-secret",
  });
}

function callDetail(overrides: Record<string, unknown> = {}) {
  return {
    code: 0,
    message: "success",
    data: {
      sip_call_id: "sip-1",
      call_id: "123e4567-e89b-42d3-a456-426614174000",
      agent_id: "agent-1",
      agent_name: "Maya",
      from_number: "+918065354350",
      to_number: "+918800112233",
      campaign_id: null,
      campaign_name: null,
      campaign_exists: false,
      direction: "outbound",
      hangup_reason: null,
      hangup_reason_code: null,
      call_category: null,
      transfer_phone_number: null,
      record_file_url: null,
      duration_seconds: 0,
      answered_ts: null,
      start_ts: 1787800000,
      end_ts: null,
      channel_name: "call-channel",
      agent_session_id: "agent-session-1",
      structured_output: null,
      transcript: [],
      ...overrides,
    },
    request_id: "request-1",
    ts: 1787800001,
  };
}

describe("GET /api/telephony/calls/[callId]", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated status requests", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches call detail with server-side Agora credentials", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    const fetchSpy = vi.mocked(global.fetch).mockResolvedValue(
      Response.json(callDetail()),
    );

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.agora.io/conversational-ai/v2/calls/123e4567-e89b-42d3-a456-426614174000?source_system=external",
      {
        headers: {
          Authorization: `Basic ${Buffer.from("customer-id:customer-secret").toString("base64")}`,
        },
        cache: "no-store",
      },
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    ["dialing", {}, "dialing"],
    ["answered", { answered_ts: 1787800005 }, "live"],
    [
      "ended normally",
      {
        answered_ts: 1787800005,
        end_ts: 1787800065,
        duration_seconds: 60,
        call_category: "completed",
        hangup_reason: "normal_hangup",
        record_file_url: "https://recordings.example/call.wav",
        transcript: [
          { role: "assistant", content: "Hello, how can I help?" },
          { role: "user", content: "I need support." },
        ],
        structured_output: [
          {
            variable_name: "appointment_confirmed",
            type: "boolean",
            criteria: "User confirmed the appointment",
            value: true,
          },
        ],
      },
      "completed",
    ],
    [
      "failed",
      {
        end_ts: 1787800010,
        call_category: "failed",
        hangup_reason: "destination_unavailable",
      },
      "failed",
    ],
    [
      "unanswered",
      {
        end_ts: 1787800010,
        call_category: "no_answer",
        hangup_reason: "ring_timeout",
      },
      "failed",
    ],
  ])("maps a %s call to its expected phase", async (_label, overrides, expectedPhase) => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(callDetail(overrides)),
    );

    const response = await GET(new Request("http://localhost") as never, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      callId: "123e4567-e89b-42d3-a456-426614174000",
      phase: expectedPhase,
      agentSessionId: "agent-session-1",
      fromNumber: "+918065354350",
      toNumber: "+918800112233",
    });
    if (expectedPhase === "completed") {
      expect(body).toMatchObject({
        durationSeconds: 60,
        recordingUrl: "https://recordings.example/call.wav",
        transcript: [
          { role: "assistant", content: "Hello, how can I help?" },
          { role: "user", content: "I need support." },
        ],
        structuredOutput: [
          {
            variable_name: "appointment_confirmed",
            type: "boolean",
            criteria: "User confirmed the appointment",
            value: true,
          },
        ],
      });
    }
  });

  it("keeps a newly-created call in dialing state while detail is eventually consistent", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ detail: "Call not found" }, { status: 404 }),
    );

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      callId: "123e4567-e89b-42d3-a456-426614174000",
      phase: "dialing",
    });
  });

  it("surfaces non-404 upstream failures without leaking credentials", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ detail: "Call service unavailable" }, { status: 503 }),
    );

    const response = await GET(new Request("http://localhost") as never, routeContext);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Call service unavailable" });
    expect(JSON.stringify(body)).not.toContain("customer-secret");
  });
});
