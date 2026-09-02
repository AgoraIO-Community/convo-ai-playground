import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EAgentState } from "@/types/agora";
import VoiceAgentStage from "./VoiceAgentStage";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@/services/uiService", () => ({ showToast: mocks.showToast }));

describe("VoiceAgentStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it.each([
    [EAgentState.IDLE, "Idle", "idle"],
    [EAgentState.LISTENING, "Listening", "listening"],
    [EAgentState.THINKING, "Thinking", "thinking"],
    [EAgentState.SPEAKING, "Speaking", "speaking"],
    [EAgentState.SILENT, "Silent", "silent"],
  ])("maps %s to an accessible %s state", (agentState, label, visualState) => {
    render(
      <VoiceAgentStage
        agentName="Maya"
        agentState={agentState}
        isAgentActive
        transcriptionMode="rtm"
      />,
    );

    expect(screen.getByText(label)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("voice-agent-orb")).toHaveAttribute(
      "data-agent-visual-state",
      visualState,
    );
  });

  it("does not invent a live state without RTM", () => {
    render(
      <VoiceAgentStage
        agentName="Maya"
        agentState={EAgentState.SPEAKING}
        isAgentActive
        transcriptionMode="rtc"
      />,
    );

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("Speaking")).not.toBeInTheDocument();
  });

  it("shows a ready state before the agent starts", () => {
    render(
      <VoiceAgentStage
        agentName="Maya"
        agentState={EAgentState.IDLE}
        isAgentActive={false}
        transcriptionMode="rtm"
      />,
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows and copies the runtime agent ID below the agent name", async () => {
    render(
      <VoiceAgentStage
        agentId="runtime-agent-123"
        agentName="Maya"
        agentState={EAgentState.LISTENING}
        isAgentActive
        transcriptionMode="rtm"
      />,
    );

    const name = screen.getByRole("heading", { name: "Maya" });
    const copyButton = screen.getByRole("button", { name: "Copy agent ID" });
    expect(
      name.compareDocumentPosition(copyButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("runtime-agent-123")).toBeInTheDocument();

    fireEvent.click(copyButton);
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenCalledWith("runtime-agent-123"),
    );
    expect(mocks.showToast).toHaveBeenCalledWith("Agent ID copied", "success");
  });
});
