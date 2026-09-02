import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EAgentState } from "@/types/agora";
import AgentTile from "./AgentTile";

describe("AgentTile", () => {
  it("uses the professional voice stage when avatar video is unavailable", () => {
    render(
      <AgentTile
        agentUid="agent-1"
        agentName="Maya"
        agentState={EAgentState.LISTENING}
        transcriptionMode="rtm"
        videoTrack={null}
      />,
    );

    expect(screen.getByTestId("voice-agent-stage")).toBeInTheDocument();
    expect(screen.getByTestId("agent-glyph")).toBeInTheDocument();
    expect(screen.getByText("Listening")).toBeInTheDocument();
  });

  it("shows the runtime agent ID below the avatar name", () => {
    const videoTrack = {
      play: vi.fn(),
      stop: vi.fn(),
    };

    render(
      <AgentTile
        agentId="runtime-agent-123"
        agentUid="avatar-999999"
        agentName="Maya"
        agentState={EAgentState.LISTENING}
        transcriptionMode="rtm"
        videoTrack={videoTrack as never}
      />,
    );

    const identity = screen.getByTestId("agent-video-identity");
    expect(within(identity).getByText("Maya")).toBeInTheDocument();
    expect(within(identity).getByText("runtime-agent-123")).toBeInTheDocument();
    expect(
      within(identity).getByRole("button", { name: "Copy agent ID" }),
    ).toBeInTheDocument();
    expect(identity).not.toHaveTextContent("avatar-999999");
  });
});
