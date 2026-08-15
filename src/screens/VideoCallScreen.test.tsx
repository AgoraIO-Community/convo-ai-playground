import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EAgentState } from "@/types/agora";
import useAppStore from "@/store/useAppStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/useAgora", () => ({
  useAgora: () => ({
    leaveCall: vi.fn(),
    localTracks: { audioTrack: null, videoTrack: null },
    avatarVideoTrack: null,
    rtcClient: {},
    rtmClient: {},
  }),
}));

vi.mock("@/hooks/useConversationalAI", () => ({
  useConversationalAI: () => ({ sendChatMessage: vi.fn() }),
}));

vi.mock("@/components/AgentTile", () => ({ default: () => <div /> }));
vi.mock("@/components/VideoTile", () => ({ default: () => <div /> }));
vi.mock("@/components/Controls", () => ({ default: () => <div /> }));
vi.mock("@/components/common/BottomSheet", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/TranscriptSidePanel", () => ({
  default: ({ onSendMessage }: { onSendMessage?: unknown }) => (
    <div data-testid="transcript-panel" data-chat={onSendMessage ? "on" : "off"} />
  ),
}));

import VideoCallScreen from "./VideoCallScreen";

describe("VideoCallScreen transcript transport", () => {
  beforeEach(() => {
    useAppStore.setState({
      localUsername: "Bhupendra",
      localUID: "42",
      channelId: "channel-1",
      audioMuted: false,
      videoMuted: true,
      isAgentActive: true,
      agentState: EAgentState.IDLE,
      agentRtcUid: "agent-1",
      agentAvatarRtcUid: null,
      agentSettings: null,
      transcriptionMode: "rtm",
      sessionStartTime: null,
    });
  });

  it("shows RTM connectivity and enables chat in RTM mode", () => {
    render(<VideoCallScreen />);

    expect(screen.getByText("Connected with Agora RTC + RTM")).toBeInTheDocument();
    expect(screen.getAllByTestId("transcript-panel")[0]).toHaveAttribute(
      "data-chat",
      "on",
    );
  });

  it("shows RTC-only connectivity and disables chat in RTC mode", () => {
    useAppStore.setState({ transcriptionMode: "rtc" });
    render(<VideoCallScreen />);

    expect(screen.getByText("Connected with Agora RTC")).toBeInTheDocument();
    expect(screen.queryByText("Connected with Agora RTC + RTM")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("transcript-panel")[0]).toHaveAttribute(
      "data-chat",
      "off",
    );
  });

  it("updates the label reactively when the active transport changes", () => {
    render(<VideoCallScreen />);

    act(() => useAppStore.getState().setTranscriptionMode("rtc"));

    expect(screen.getByText("Connected with Agora RTC")).toBeInTheDocument();
  });
});
