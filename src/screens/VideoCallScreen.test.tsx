import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EAgentState } from "@/types/agora";
import useAppStore from "@/store/useAppStore";

const mocks = vi.hoisted(() => ({
  leaveCall: vi.fn(),
  setLocalVideoEnabled: vi.fn(),
  showToast: vi.fn(),
  pauseDemo: vi.fn(),
  clearBoard: vi.fn(),
  sendTeacherQuestion: vi.fn(),
  cancelLesson: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/useAgora", () => ({
  useAgora: () => ({
    leaveCall: mocks.leaveCall,
    setLocalVideoEnabled: mocks.setLocalVideoEnabled,
    localTracks: { audioTrack: null, videoTrack: null },
    avatarVideoTrack: null,
    rtcClient: {},
    rtmClient: {},
  }),
}));

vi.mock("@/services/uiService", () => ({ showToast: mocks.showToast }));

vi.mock("@/hooks/useConversationalAI", () => ({
  useConversationalAI: () => ({ sendChatMessage: vi.fn() }),
}));

vi.mock("@/hooks/useTeacherBoardSession", () => ({
  useTeacherBoardSession: () => ({
    session: {
      sessionId: "teacher-session-1",
      token: "teacher-token",
      liveMcpConfigured: true,
    },
    connection: "live",
    boardState: { elements: {}, order: [], revision: 0 },
    activeAnimation: null,
    playDemo: vi.fn(),
    pauseDemo: mocks.pauseDemo,
    clearBoard: mocks.clearBoard,
  }),
}));

vi.mock("@/hooks/useTeacherLessonDirector", () => ({
  useTeacherLessonDirector: () => ({
    status: "idle",
    progress: null,
    sendTeacherQuestion: mocks.sendTeacherQuestion,
    cancelLesson: mocks.cancelLesson,
  }),
}));

vi.mock("@/components/AgentTile", () => ({
  default: () => <div data-testid="agent-video-stage" />,
}));
vi.mock("@/components/VideoTile", () => ({
  default: () => <div data-testid="local-video-stage" />,
}));
vi.mock("@/components/Controls", () => ({
  default: ({
    experienceMode,
    onTeacherModeToggle,
  }: {
    experienceMode: string;
    onTeacherModeToggle: () => void;
  }) => (
    <div data-testid="controls" data-experience-mode={experienceMode}>
      <button onClick={onTeacherModeToggle}>Toggle Teacher Mode</button>
    </div>
  ),
}));
vi.mock("@/components/common/BottomSheet", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/TranscriptSidePanel", () => ({
  default: ({ onSendMessage }: { onSendMessage?: unknown }) => (
    <div data-testid="transcript-panel" data-chat={onSendMessage ? "on" : "off"} />
  ),
}));
vi.mock("@/components/teacher/TeacherStage", () => ({
  default: () => <div data-testid="teacher-stage" />,
}));

import VideoCallScreen from "./VideoCallScreen";

describe("VideoCallScreen transcript transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leaveCall.mockResolvedValue(undefined);
    mocks.setLocalVideoEnabled.mockResolvedValue(undefined);
    useAppStore.setState({
      localUsername: "Bhupendra",
      localUID: "42",
      channelId: "channel-1",
      audioMuted: false,
      videoMuted: true,
      isAgentActive: false,
      agentId: null,
      agentState: EAgentState.IDLE,
      agentRtcUid: "agent-1",
      agentAvatarRtcUid: null,
      agentSettings: null,
      transcriptionMode: "rtm",
      sessionStartTime: null,
    });
  });

  it("shows RTM connectivity and enables chat in RTM mode", async () => {
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Teacher Mode" }));

    expect(
      await screen.findByText("Connected with Agora RTC + RTM"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("transcript-panel")[0]).toHaveAttribute(
      "data-chat",
      "on",
    );
  });

  it("shows RTC-only connectivity and disables chat in RTC mode", async () => {
    useAppStore.setState({ transcriptionMode: "rtc" });
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Teacher Mode" }));

    expect(await screen.findByText("Connected with Agora RTC")).toBeInTheDocument();
    expect(screen.queryByText("Connected with Agora RTC + RTM")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("transcript-panel")[0]).toHaveAttribute(
      "data-chat",
      "off",
    );
  });

  it("updates the label reactively when the active transport changes", async () => {
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Teacher Mode" }));
    await screen.findByText("Connected with Agora RTC + RTM");

    act(() => useAppStore.getState().setTranscriptionMode("rtc"));

    expect(screen.getByText("Connected with Agora RTC")).toBeInTheDocument();
  });

  it("starts in teacher mode when the camera is unpublished", () => {
    render(<VideoCallScreen />);

    expect(screen.getByTestId("teacher-stage")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-agent-stage")).not.toBeInTheDocument();
    expect(screen.queryByTestId("local-video-stage")).not.toBeInTheDocument();
    expect(screen.getByTestId("controls")).toHaveAttribute(
      "data-experience-mode",
      "teacher",
    );
  });

  it("publishes the camera before entering video mode and preserves transcript", async () => {
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));

    await waitFor(() =>
      expect(mocks.setLocalVideoEnabled).toHaveBeenCalledWith(true),
    );
    expect(screen.getByTestId("local-video-stage")).toBeInTheDocument();
    expect(screen.getAllByTestId("transcript-panel")).not.toHaveLength(0);
    expect(useAppStore.getState().isAgentActive).toBe(false);
  });

  it("stays in voice mode when camera publication fails", async () => {
    mocks.setLocalVideoEnabled.mockImplementation(async (enabled: boolean) => {
      if (enabled) throw new Error("Permission denied");
    });
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledOnce());
    expect(screen.getByTestId("voice-agent-stage")).toBeInTheDocument();
    expect(screen.queryByTestId("local-video-stage")).not.toBeInTheDocument();
  });

  it("unpublishes the camera before returning to voice mode", async () => {
    useAppStore.setState({ videoMuted: false });
    render(<VideoCallScreen />);

    fireEvent.click(screen.getByRole("radio", { name: "Video Agent" }));
    await screen.findByTestId("local-video-stage");

    fireEvent.click(screen.getByRole("radio", { name: "Voice Agent" }));

    await waitFor(() =>
      expect(mocks.setLocalVideoEnabled).toHaveBeenCalledWith(false),
    );
    expect(screen.getByTestId("voice-agent-stage")).toBeInTheDocument();
  });
});
