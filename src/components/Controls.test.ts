import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onEndCall: vi.fn(),
  toggleLocalAudio: vi.fn(),
  toggleLocalVideo: vi.fn(),
  configureRtm: vi.fn(),
  inviteAgent: vi.fn(),
  setAgentLoading: vi.fn(),
  setAgentActive: vi.fn(),
  setAgentSettings: vi.fn(),
  setAgentUpdating: vi.fn(),
  clearAgent: vi.fn(),
  appendAgentSession: vi.fn(),
  setTranscriptionMode: vi.fn(),
  addToast: vi.fn(),
  getCustomAgentSettings: vi.fn(),
  settingsSidebarProps: [] as Array<{
    isOpen: boolean;
    asSheet?: boolean;
  }>,
}));

const state = {
  audioMuted: false,
  videoMuted: false,
  channelId: "channel-private",
  localUID: "42",
  localUsername: "Ada",
  agentId: null,
  isAgentActive: false,
  isAgentLoading: false,
  isAgentUpdating: false,
  agentSettings: { advanced_features: { enable_rtm: true } },
  setAgentLoading: mocks.setAgentLoading,
  setAgentActive: mocks.setAgentActive,
  setAgentUpdating: mocks.setAgentUpdating,
  clearAgent: mocks.clearAgent,
  setAgentSettings: mocks.setAgentSettings,
  appendAgentSession: mocks.appendAgentSession,
  setTranscriptionMode: mocks.setTranscriptionMode,
  addToast: mocks.addToast,
};

vi.mock("@/store/useAppStore", () => {
  const useStore = (selector: (value: typeof state) => unknown) => selector(state);
  useStore.getState = () => state;
  return { default: useStore };
});

vi.mock("@/hooks/useAgora", () => ({
  useAgora: () => ({
    toggleLocalAudio: mocks.toggleLocalAudio,
    toggleLocalVideo: mocks.toggleLocalVideo,
    configureRtm: mocks.configureRtm,
  }),
}));

vi.mock("@/api/agentApi", () => ({
  inviteAgent: mocks.inviteAgent,
  stopAgent: vi.fn(),
  updateAgent: vi.fn(),
}));

vi.mock("@/services/settingsDb", () => ({
  getCustomAgentSettings: mocks.getCustomAgentSettings,
  setAgentSettings: vi.fn(),
}));

vi.mock("@/components/SettingsSidebar", () => ({
  default: (props: { isOpen: boolean; asSheet?: boolean }) => {
    mocks.settingsSidebarProps.push(props);
    return props.isOpen
      ? React.createElement("div", null, "Full agent settings")
      : null;
  },
}));

import Controls from "./Controls";

describe("Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onEndCall.mockResolvedValue(undefined);
    mocks.inviteAgent.mockResolvedValue({
      agentId: "agent-1",
      agentRtcUid: "100",
    });
    mocks.configureRtm.mockResolvedValue(null);
    mocks.getCustomAgentSettings.mockResolvedValue(null);
    mocks.settingsSidebarProps.length = 0;
    state.agentSettings = { advanced_features: { enable_rtm: true } };
  });

  it("renders exactly the five requested call controls", () => {
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn camera off" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End call" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agent settings" })).toBeInTheDocument();
  });

  it("starts the agent and opens settings without a host role", async () => {
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    fireEvent.click(screen.getByRole("button", { name: "Start agent" }));
    await waitFor(() => expect(mocks.setAgentActive).toHaveBeenCalledOnce());
    expect(screen.queryByText("Full agent settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agent settings" }));
    expect(screen.getByText("Full agent settings")).toBeInTheDocument();
  });

  it("opens agent settings as a side panel instead of a bottom sheet", () => {
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    fireEvent.click(screen.getByRole("button", { name: "Agent settings" }));

    const latestProps =
      mocks.settingsSidebarProps[mocks.settingsSidebarProps.length - 1];
    expect(latestProps?.isOpen).toBe(true);
    expect(latestProps?.asSheet).not.toBe(true);
  });

  it("uses RTC data-stream delivery when RTM is disabled", async () => {
    state.agentSettings = { advanced_features: { enable_rtm: false } };
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    fireEvent.click(screen.getByRole("button", { name: "Start agent" }));

    await waitFor(() => expect(mocks.inviteAgent).toHaveBeenCalledOnce());
    expect(mocks.inviteAgent).toHaveBeenCalledWith(
      "channel-private",
      "42",
      expect.objectContaining({
        advanced_features: expect.objectContaining({ enable_rtm: false }),
        parameters: expect.objectContaining({ data_channel: "rtc" }),
      }),
      expect.any(Object),
    );
    expect(mocks.setTranscriptionMode).toHaveBeenCalledWith("rtc");
    expect(mocks.configureRtm).toHaveBeenCalledWith(false);
  });

  it("honors RTC delivery in a custom agent payload", async () => {
    mocks.getCustomAgentSettings.mockResolvedValue({
      useCustomPayload: true,
      customPayloadJson: JSON.stringify({
        name: "custom-agent",
        properties: {
          advanced_features: { enable_rtm: false },
          parameters: { data_channel: "datastream" },
        },
      }),
    });
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    fireEvent.click(screen.getByRole("button", { name: "Start agent" }));

    await waitFor(() => expect(mocks.inviteAgent).toHaveBeenCalledOnce());
    expect(mocks.inviteAgent).toHaveBeenCalledWith(
      "channel-private",
      "42",
      expect.any(Object),
      expect.objectContaining({
        customJoinPayload: expect.objectContaining({
          properties: expect.objectContaining({
            advanced_features: expect.objectContaining({ enable_rtm: false }),
            parameters: expect.objectContaining({ data_channel: "rtc" }),
          }),
        }),
      }),
    );
    expect(mocks.setTranscriptionMode).toHaveBeenCalledWith("rtc");
    expect(mocks.configureRtm).toHaveBeenCalledWith(false);
  });

  it("delegates end-call cleanup before the screen navigates", () => {
    render(React.createElement(Controls, { onEndCall: mocks.onEndCall }));

    fireEvent.click(screen.getByRole("button", { name: "End call" }));

    expect(mocks.onEndCall).toHaveBeenCalledOnce();
  });
});
