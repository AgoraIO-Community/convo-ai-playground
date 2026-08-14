import { describe, expect, it } from "vitest";
import { createRtcSessionTokens } from "./agoraTokens";

const APP_ID = "970CA35de60c44645bbae8a215061b33";
const APP_CERTIFICATE = "5CFd2fd1755d40ecb72977518be15d3b";

describe("createRtcSessionTokens", () => {
  it("creates a private channel with matching RTC and RTM identities", () => {
    const session = createRtcSessionTokens({
      appId: APP_ID,
      appCertificate: APP_CERTIFICATE,
      displayName: "Ada Lovelace",
    });

    expect(session.channelName).toMatch(/^channel-[0-9a-f-]{36}$/);
    expect(session.rtcUid).toBeGreaterThanOrEqual(1);
    expect(session.rtcUid).toBeLessThanOrEqual(2_147_483_646);
    expect(session.rtmUserId).toBe(String(session.rtcUid));
    expect(session.rtcToken).toMatch(/^007/);
    expect(session.rtmToken).toMatch(/^007/);
    expect(session.displayName).toBe("Ada Lovelace");
    expect(session.expiresInSeconds).toBe(3600);
  });

  it("creates a distinct channel for each call session", () => {
    const first = createRtcSessionTokens({
      appId: APP_ID,
      appCertificate: APP_CERTIFICATE,
      displayName: "Ada Lovelace",
    });
    const second = createRtcSessionTokens({
      appId: APP_ID,
      appCertificate: APP_CERTIFICATE,
      displayName: "Ada Lovelace",
    });

    expect(second.channelName).not.toBe(first.channelName);
  });

  it.each([
    { appId: "", appCertificate: APP_CERTIFICATE },
    { appId: APP_ID, appCertificate: "" },
  ])("rejects missing server credentials", (credentials) => {
    expect(() =>
      createRtcSessionTokens({
        ...credentials,
        displayName: "Ada Lovelace",
      }),
    ).toThrow("Agora server credentials are not configured");
  });
});
