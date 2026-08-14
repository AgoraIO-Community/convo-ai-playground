import { afterEach, describe, expect, it, vi } from "vitest";
import { createRtcSession } from "./agoraApi";

describe("createRtcSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a new authenticated call session without client identifiers", async () => {
    const session = {
      channelName: "channel-123",
      rtcUid: 42,
      rtmUserId: "42",
      rtcToken: "rtc-token",
      rtmToken: "rtm-token",
      displayName: "Ada Lovelace",
      expiresInSeconds: 3600,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createRtcSession()).resolves.toEqual(session);
    expect(fetchSpy).toHaveBeenCalledWith("/api/rtc/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("surfaces the server error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createRtcSession()).rejects.toThrow("Authentication required");
  });
});
