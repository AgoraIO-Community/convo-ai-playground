import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RtcSessionResponse } from "@/types/rtcSession";

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  const nativeAudioStop = vi.fn();
  const nativeVideoStop = vi.fn();
  const audioTrack = {
    getMediaStreamTrack: () => ({ stop: nativeAudioStop }),
    stop: vi.fn(),
    close: vi.fn(),
  };
  const videoTrack = {
    getMediaStreamTrack: () => ({ stop: nativeVideoStop }),
    stop: vi.fn(),
    close: vi.fn(),
  };
  const rtcClient = {
    connectionState: "DISCONNECTED",
    remoteUsers: [],
    on: vi.fn(),
    join: vi.fn(async () => {
      order.push("rtc-join");
    }),
    publish: vi.fn(async () => {
      order.push("rtc-publish");
    }),
    unpublish: vi.fn(),
    leave: vi.fn(),
    subscribe: vi.fn(),
  };
  const rtmClient = {
    login: vi.fn(async () => {
      order.push("rtm-login");
    }),
    subscribe: vi.fn(async () => {
      order.push("rtm-subscribe");
    }),
    unsubscribe: vi.fn(),
    logout: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return {
    order,
    audioTrack,
    videoTrack,
    rtcClient,
    rtmClient,
    nativeAudioStop,
    nativeVideoStop,
    setParameter: vi.fn((key: string, value: boolean) => {
      order.push(`set-parameter:${key}:${value}`);
    }),
    createClient: vi.fn(() => {
      order.push("create-client");
      return rtcClient;
    }),
    createMicrophoneAudioTrack: vi.fn(async () => {
      order.push("microphone");
      return audioTrack;
    }),
    createCameraVideoTrack: vi.fn(async () => {
      order.push("camera");
      return videoTrack;
    }),
    RtmConstructor: vi.fn(function RtmConstructor() {
      return rtmClient;
    }),
  };
});

vi.mock("agora-rtc-sdk-ng", () => ({
  default: {
    setParameter: mocks.setParameter,
    createClient: mocks.createClient,
    createMicrophoneAudioTrack: mocks.createMicrophoneAudioTrack,
    createCameraVideoTrack: mocks.createCameraVideoTrack,
  },
}));

vi.mock("agora-rtm", () => ({
  default: { RTM: mocks.RtmConstructor },
}));

vi.mock("@/api/agentApi", () => ({ stopAgent: vi.fn() }));

const session: RtcSessionResponse = {
  channelName: "channel-private",
  rtcUid: 42,
  rtmUserId: "42",
  rtcToken: "rtc-token",
  rtmToken: "rtm-token",
  displayName: "Ada",
  expiresInSeconds: 3600,
};

describe("useAgora direct session", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_AGORA_APP_ID = "test-app-id";
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.rtcClient.connectionState = "DISCONNECTED";
    mocks.rtcClient.join.mockImplementation(async () => {
      mocks.order.push("rtc-join");
    });
  });

  it("enables audio PTS metadata before creating the RTC client", async () => {
    const { useAgora } = await import("./useAgora");
    const { result } = renderHook(() => useAgora());

    await result.current.joinMeeting(session, true);

    expect(mocks.setParameter).toHaveBeenCalledWith(
      "ENABLE_AUDIO_PTS_METADATA",
      true,
    );
    expect(
      mocks.order.indexOf("set-parameter:ENABLE_AUDIO_PTS_METADATA:true"),
    ).toBeLessThan(mocks.order.indexOf("create-client"));
  });

  it("uses one identity and channel for RTM and RTC, then publishes", async () => {
    const { useAgora } = await import("./useAgora");
    const { result } = renderHook(() => useAgora());

    await result.current.joinMeeting(session, true);

    expect(mocks.RtmConstructor).toHaveBeenCalledWith("test-app-id", "42", {
      useStringUserId: true,
    });
    expect(mocks.rtmClient.subscribe).toHaveBeenCalledWith(
      "channel-private",
      expect.objectContaining({
        withMessage: true,
        withPresence: true,
      }),
    );
    expect(mocks.rtcClient.join).toHaveBeenCalledWith(
      "test-app-id",
      "channel-private",
      "rtc-token",
      42,
    );
    expect(mocks.order).toEqual([
      "set-parameter:ENABLE_AUDIO_PTS_METADATA:true",
      "create-client",
      "microphone",
      "camera",
      "rtm-login",
      "rtm-subscribe",
      "rtc-join",
      "rtc-publish",
    ]);
  });

  it("joins and publishes RTC without creating RTM when it is disabled", async () => {
    const { useAgora } = await import("./useAgora");
    const { result } = renderHook(() => useAgora());

    await act(async () => {
      await result.current.joinMeeting(session, false);
    });

    expect(mocks.RtmConstructor).not.toHaveBeenCalled();
    expect(mocks.rtcClient.join).toHaveBeenCalledOnce();
    expect(mocks.rtcClient.publish).toHaveBeenCalledOnce();
    expect(result.current.rtmClient).toBeNull();
  });

  it("connects and disconnects RTM for the active RTC session", async () => {
    const { useAgora } = await import("./useAgora");
    const { result } = renderHook(() => useAgora());

    await act(async () => {
      await result.current.joinMeeting(session, false);
      await result.current.configureRtm(true);
    });

    await waitFor(() => expect(result.current.rtmClient).toBe(mocks.rtmClient));
    expect(mocks.rtmClient.login).toHaveBeenCalledWith({ token: "rtm-token" });
    expect(mocks.rtmClient.subscribe).toHaveBeenCalledWith(
      "channel-private",
      expect.objectContaining({ withMessage: true, withPresence: true }),
    );

    await act(async () => {
      await result.current.configureRtm(false);
    });

    await waitFor(() => expect(result.current.rtmClient).toBeNull());
    expect(mocks.rtmClient.unsubscribe).toHaveBeenCalledWith("channel-private");
    expect(mocks.rtmClient.logout).toHaveBeenCalled();
  });

  it("releases partially initialized resources when RTC joining fails", async () => {
    mocks.rtcClient.join.mockRejectedValueOnce(new Error("RTC rejected"));
    const { useAgora } = await import("./useAgora");
    const { result } = renderHook(() => useAgora());

    await expect(result.current.joinMeeting(session, true)).rejects.toThrow(
      "RTC rejected",
    );

    expect(mocks.nativeAudioStop).toHaveBeenCalled();
    expect(mocks.nativeVideoStop).toHaveBeenCalled();
    expect(mocks.audioTrack.close).toHaveBeenCalled();
    expect(mocks.videoTrack.close).toHaveBeenCalled();
    expect(mocks.rtmClient.unsubscribe).toHaveBeenCalledWith("channel-private");
    expect(mocks.rtmClient.logout).toHaveBeenCalled();
  });
});
