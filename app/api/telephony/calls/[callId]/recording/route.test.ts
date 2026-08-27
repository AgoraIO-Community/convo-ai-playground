import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "./route";

const mockedAuth = vi.mocked(auth);
const originalEnv = { ...process.env };
const callId = "123e4567-e89b-42d3-a456-426614174000";
const routeContext = { params: Promise.resolve({ callId }) };

function configureEnvironment() {
  Object.assign(process.env, {
    AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
    AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
    NEXT_PUBLIC_AGORA_APP_ID: "app-id",
    AGORA_CUSTOMER_ID: "customer-id",
    AGORA_CUSTOMER_SECRET: "customer-secret",
  });
}

describe("GET /api/telephony/calls/[callId]/recording", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated recording downloads", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refreshes the signed URL and streams the recording as an attachment", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    const fetchSpy = vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        Response.json({
          code: 0,
          message: "success",
          data: {
            call_id: callId,
            record_file_url: "https://recordings.example/signed/call.wav",
          },
          request_id: "request-1",
          ts: 1787800001,
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([82, 73, 70, 70]), {
          headers: { "Content-Type": "audio/wav" },
        }),
      );

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(fetchSpy.mock.calls[0]).toEqual([
      `https://api.agora.io/conversational-ai/v2/calls/${callId}?source_system=external`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from("customer-id:customer-secret").toString("base64")}`,
        },
        cache: "no-store",
      },
    ]);
    expect(fetchSpy.mock.calls[1]).toEqual([
      "https://recordings.example/signed/call.wav",
      { cache: "no-store" },
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="call-${callId}.wav"`,
    );
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      82, 73, 70, 70,
    ]);
  });

  it("streams inline recording byte ranges for browser playback and seeking", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    const fetchSpy = vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        Response.json({
          code: 0,
          message: "success",
          data: {
            call_id: callId,
            record_file_url: "https://recordings.example/signed/call.mp3",
          },
          request_id: "request-1",
          ts: 1787800001,
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([73, 68, 51]), {
          status: 206,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": "3",
            "Content-Range": "bytes 0-2/3000",
            "Content-Type": "audio/mpeg",
          },
        }),
      );
    const request = new Request(
      "http://localhost/api/telephony/calls/call-id/recording?disposition=inline",
      { headers: { Range: "bytes=0-1023" } },
    );

    const response = await GET(request as never, routeContext);

    expect(fetchSpy.mock.calls[1]).toEqual([
      "https://recordings.example/signed/call.mp3",
      {
        cache: "no-store",
        headers: { Range: "bytes=0-1023" },
      },
    ]);
    expect(response.status).toBe(206);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-2/3000");
    expect(response.headers.get("Content-Disposition")).toBe(
      `inline; filename="call-${callId}.mp3"`,
    );
  });

  it("reports when recording processing has not completed", async () => {
    mockedAuth.mockResolvedValue({ user: { email: "user@example.com" } });
    configureEnvironment();
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({
        code: 0,
        message: "success",
        data: { call_id: callId, record_file_url: null },
        request_id: "request-1",
        ts: 1787800001,
      }),
    );

    const response = await GET(new Request("http://localhost") as never, routeContext);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Recording is not available yet",
    });
  });
});
