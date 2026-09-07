import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ElevenLabsVoiceCloner from "./ElevenLabsVoiceCloner";

describe("ElevenLabsVoiceCloner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a sample and applies the returned ElevenLabs voice ID", async () => {
    const onVoiceCloned = vi.fn();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        voiceId: "voice_clone_123",
        requiresVerification: false,
        previewUrl: "data:audio/mpeg;base64,SUQz",
      }),
    );
    render(
      <ElevenLabsVoiceCloner
        apiKey="settings-key"
        model="eleven_flash_v2_5"
        onVoiceCloned={onVoiceCloned}
      />,
    );

    fireEvent.change(screen.getByLabelText("Voice name"), {
      target: { value: "My ElevenLabs Voice" },
    });
    fireEvent.change(screen.getByLabelText("Voice sample"), {
      target: {
        files: [
          new File([new Uint8Array([73, 68, 51])], "voice.mp3", {
            type: "audio/mpeg",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /permission/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clone voice" }));

    await waitFor(() =>
      expect(onVoiceCloned).toHaveBeenCalledWith({
        voiceId: "voice_clone_123",
        name: "My ElevenLabs Voice",
      }),
    );
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/tts/elevenlabs/voice-clone");
    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get("apiKey")).toBe("settings-key");
    expect(body.get("model")).toBe("eleven_flash_v2_5");
    expect(body.get("previewText")).toBe(
      "Hello! This is a preview of my cloned voice.",
    );
    expect(screen.getByText("Voice ready")).toBeInTheDocument();
    expect(screen.getByText("voice_clone_123")).toBeInTheDocument();
    expect(screen.getByLabelText("Cloned voice preview")).toHaveAttribute(
      "src",
      "data:audio/mpeg;base64,SUQz",
    );
  });

  it("keeps the cloned voice selected when preview generation fails", async () => {
    const onVoiceCloned = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        voiceId: "voice_clone_456",
        requiresVerification: false,
        previewError: "Preview generation failed with HTTP 429.",
      }),
    );
    render(
      <ElevenLabsVoiceCloner
        apiKey="settings-key"
        model="eleven_flash_v2_5"
        onVoiceCloned={onVoiceCloned}
      />,
    );

    fireEvent.change(screen.getByLabelText("Voice name"), {
      target: { value: "Voice Without Preview" },
    });
    fireEvent.change(screen.getByLabelText("Voice sample"), {
      target: {
        files: [
          new File([new Uint8Array([73, 68, 51])], "voice.mp3", {
            type: "audio/mpeg",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /permission/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clone voice" }));

    await waitFor(() =>
      expect(onVoiceCloned).toHaveBeenCalledWith({
        voiceId: "voice_clone_456",
        name: "Voice Without Preview",
      }),
    );
    expect(screen.getByText("Voice ready")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preview generation failed with HTTP 429.",
    );
    expect(screen.queryByLabelText("Cloned voice preview")).not.toBeInTheDocument();
  });

  it("offers recording and recommends clean one-to-two-minute samples", () => {
    render(
      <ElevenLabsVoiceCloner
        apiKey=""
        model="eleven_flash_v2_5"
        onVoiceCloned={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Record voice" })).toBeInTheDocument();
    expect(screen.getByText(/1–2 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/MP3, M4A, WAV, or WebM/i)).toBeInTheDocument();
  });
});
