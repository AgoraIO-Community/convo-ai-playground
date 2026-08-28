import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
