import React, { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RtcSessionResponse } from "@/types/rtcSession";

const mocks = vi.hoisted(() => ({
  createRtcSession: vi.fn(),
  joinMeeting: vi.fn(),
  callStart: vi.fn(),
  signOut: vi.fn(),
  storeState: {
    callActive: false,
    callStart: vi.fn(),
    agentSettings: { advanced_features: { enable_rtm: false } },
  },
}));

vi.mock("@/api/agoraApi", () => ({
  createRtcSession: mocks.createRtcSession,
}));

vi.mock("@/hooks/useAgora", () => ({
  useAgora: () => ({ joinMeeting: mocks.joinMeeting }),
}));

vi.mock("@/store/useAppStore", () => ({
  default: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mocks.storeState),
}));

vi.mock("next-auth/react", () => ({
  signOut: mocks.signOut,
}));

vi.mock("@/screens/VideoCallScreen", () => ({
  default: () => null,
}));

import CallBootstrapScreen from "./CallBootstrapScreen";

const rtcSession: RtcSessionResponse = {
  channelName: "channel-123",
  rtcUid: 42,
  rtmUserId: "42",
  rtcToken: "rtc-token",
  rtmToken: "rtm-token",
  displayName: "Ada Lovelace",
  expiresInSeconds: 3600,
};

describe("CallBootstrapScreen", () => {
  beforeEach(() => {
    mocks.createRtcSession.mockReset();
    mocks.joinMeeting.mockReset();
    mocks.callStart.mockReset();
    mocks.signOut.mockReset();
    mocks.storeState.callStart = mocks.callStart;
    mocks.storeState.agentSettings = {
      advanced_features: { enable_rtm: false },
    };
    mocks.createRtcSession.mockResolvedValue(rtcSession);
    mocks.joinMeeting.mockResolvedValue(undefined);
  });

  it("creates and joins one session under React Strict Mode", async () => {
    render(
      React.createElement(
        StrictMode,
        null,
        React.createElement(CallBootstrapScreen),
      ),
    );

    await waitFor(() => expect(mocks.joinMeeting).toHaveBeenCalledTimes(1));
    expect(mocks.createRtcSession).toHaveBeenCalledTimes(1);
    expect(mocks.joinMeeting).toHaveBeenCalledWith(rtcSession, false);
    expect(mocks.callStart).toHaveBeenCalledWith({
      displayName: "Ada Lovelace",
      rtcUid: "42",
      channelName: "channel-123",
      startedAt: expect.any(Number),
    });
  });

  it("enables RTM during call bootstrap when the persisted setting uses it", async () => {
    mocks.storeState.agentSettings = {
      advanced_features: { enable_rtm: true },
    };

    render(React.createElement(CallBootstrapScreen));

    await waitFor(() => expect(mocks.joinMeeting).toHaveBeenCalledTimes(1));
    expect(mocks.joinMeeting).toHaveBeenCalledWith(rtcSession, true);
  });

  it("shows a retry action and creates a fresh session after failure", async () => {
    mocks.createRtcSession
      .mockRejectedValueOnce(new Error("Camera permission denied"))
      .mockResolvedValueOnce(rtcSession);

    render(React.createElement(CallBootstrapScreen));

    expect(
      await screen.findByText("Camera permission denied"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.joinMeeting).toHaveBeenCalledTimes(1));
    expect(mocks.createRtcSession).toHaveBeenCalledTimes(2);
  });
});
