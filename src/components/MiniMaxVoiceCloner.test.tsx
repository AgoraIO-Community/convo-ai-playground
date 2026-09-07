import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MiniMaxVoiceCloner from "./MiniMaxVoiceCloner";

describe("MiniMaxVoiceCloner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a chosen recording and applies the cloned voice ID", async () => {
    const onVoiceCloned = vi.fn();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        voiceId: "MyVoice01",
        previewUrl: "https://cdn.minimax.test/preview.mp3",
      }),
    );
    render(
      <MiniMaxVoiceCloner
        model="speech-2.8-turbo"
        voiceId=""
        onVoiceCloned={onVoiceCloned}
      />,
    );

    fireEvent.change(screen.getByLabelText("Clone voice ID"), {
      target: { value: "MyVoice01" },
    });
    fireEvent.change(screen.getByLabelText("Voice sample"), {
      target: {
        files: [
          new File([new Uint8Array([82, 73, 70, 70])], "voice.wav", {
            type: "audio/wav",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /permission/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clone voice" }));

    await waitFor(() => expect(onVoiceCloned).toHaveBeenCalledWith("MyVoice01"));
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/tts/minimax/voice-clone");
    expect(screen.getByText("Voice ready")).toBeInTheDocument();
    expect(screen.getByLabelText("Cloned voice preview")).toHaveAttribute(
      "src",
      "https://cdn.minimax.test/preview.mp3",
    );
  });

  it("offers browser recording and explains the MiniMax sample limits", () => {
    render(
      <MiniMaxVoiceCloner
        model="speech-2.8-turbo"
        voiceId=""
        onVoiceCloned={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Record voice" })).toBeInTheDocument();
    expect(screen.getByText(/10 seconds to 5 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/MP3, M4A, or WAV/i)).toBeInTheDocument();
  });
});
