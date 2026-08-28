import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EAgentState } from "@/types/agora";
import VoiceAgentStage from "./VoiceAgentStage";

describe("VoiceAgentStage", () => {
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
});
