import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ElevenLabsVoicePicker from "./ElevenLabsVoicePicker";

describe("ElevenLabsVoicePicker", () => {
  it("shows a newly cloned voice by name as soon as it is selected", () => {
    const onChange = vi.fn();
    render(
      <ElevenLabsVoicePicker
        value="voice_clone_123"
        onChange={onChange}
        addedVoice={{ voiceId: "voice_clone_123", name: "My cloned voice" }}
      />,
    );

    expect(screen.getByText("My cloned voice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /My cloned voice/i }));
    expect(screen.getAllByText("My cloned voice").length).toBeGreaterThan(1);
  });
});
