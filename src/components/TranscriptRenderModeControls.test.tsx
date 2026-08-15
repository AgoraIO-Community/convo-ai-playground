import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ETranscriptRenderMode } from "@/types/agora";
import { TranscriptRenderModeControls } from "./TranscriptRenderModeControls";

const labels = {
  text: "Text — show complete transcript updates",
  word: "Word — reveal words as spoken",
  auto: "Auto — use word timing when available",
};

function ControlsHarness() {
  const [mode, setMode] = useState(ETranscriptRenderMode.AUTO);
  return <TranscriptRenderModeControls value={mode} onChange={setMode} />;
}

describe("TranscriptRenderModeControls", () => {
  it("exposes accessible names, pressed state, and linked tooltips", () => {
    render(<ControlsHarness />);

    const textButton = screen.getByRole("button", { name: labels.text });
    const wordButton = screen.getByRole("button", { name: labels.word });
    const autoButton = screen.getByRole("button", { name: labels.auto });

    expect(textButton).toHaveAttribute("aria-pressed", "false");
    expect(wordButton).toHaveAttribute("aria-pressed", "false");
    expect(autoButton).toHaveAttribute("aria-pressed", "true");

    for (const [button, label] of [
      [textButton, labels.text],
      [wordButton, labels.word],
      [autoButton, labels.auto],
    ] as const) {
      const tooltip = screen.getByRole("tooltip", { name: label });
      expect(button).toHaveAttribute("aria-describedby", tooltip.id);
      expect(tooltip).toHaveClass("group-hover:opacity-100");
      expect(tooltip).toHaveClass("group-focus-within:opacity-100");
    }

    fireEvent.click(wordButton);

    expect(wordButton).toHaveAttribute("aria-pressed", "true");
    expect(autoButton).toHaveAttribute("aria-pressed", "false");
  });
});
