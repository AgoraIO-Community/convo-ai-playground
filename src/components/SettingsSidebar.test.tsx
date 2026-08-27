import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAppStore from "@/store/useAppStore";
import { ASR_PRESETS, TTS_PRESETS, type AgentSettings } from "@/types/agora";
import SettingsSidebar, { getDefaultSettings } from "./SettingsSidebar";

function getOpenField(label: string): HTMLElement {
  const labelNode = screen.getByText(label, { selector: "label span" });
  const field = labelNode.closest(".mb-4");
  if (!field) throw new Error(`Could not find field container for ${label}`);
  return field as HTMLElement;
}

function getSelectButton(label: string): HTMLButtonElement {
  const button = getOpenField(label).querySelector<HTMLButtonElement>(
    ":scope > div.relative > button",
  );
  if (!button) throw new Error(`Could not find select button for ${label}`);
  return button;
}

function chooseFromField(label: string, option: string): void {
  const field = getOpenField(label);
  fireEvent.click(getSelectButton(label));
  fireEvent.click(within(field).getByRole("button", { name: option }));
}

describe("SettingsSidebar transcript transport", () => {
  beforeEach(() => {
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      advanced_features: {
        ...getDefaultSettings().advanced_features,
        enable_rtm: false,
      },
      parameters: { data_channel: "datastream" },
    });
  });

  it("applies the currently selected RTC preference through its save callback", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "datastream" },
    });
  });

  it("preserves a migrated MLLM pipeline when applying settings", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      mllm: {
        enable: true,
        vendor: "openai",
        params: { model: "gpt-realtime" },
        turn_detection: { mode: "server_vad" },
      },
    });

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].mllm).toMatchObject({
      enable: true,
      vendor: "openai",
      params: { model: "gpt-realtime" },
    });
  });

  it("exposes the v2.11 pipeline and runtime controls in the form", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /MLLM \(Realtime voice\)/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Advanced Settings/i }),
    );
    expect(screen.getByText("Interruption")).toBeInTheDocument();
    expect(screen.getByText("Geofence area")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Features/i }));
    expect(screen.getByText("Enable metrics")).toBeInTheDocument();
    expect(screen.getByText("Pipeline error messages")).toBeInTheDocument();
    expect(screen.getByText("Graceful farewell")).toBeInTheDocument();
  });

  it("exposes outbound telephony as a top-level settings tab", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Telephony" }),
    ).toBeInTheDocument();
  });

  it("offers every current v2.11 ASR and TTS vendor", () => {
    expect(
      Object.keys(TTS_PRESETS).filter(
        (vendor) => vendor !== "fish_audio" && vendor !== "polly",
      ),
    ).toEqual(
      expect.arrayContaining([
        "amazon",
        "cartesia",
        "deepgram",
        "elevenlabs",
        "fishaudio",
        "generic_http",
        "google",
        "gradium",
        "humeai",
        "microsoft",
        "minimax",
        "mistral",
        "murf",
        "openai",
        "rime",
        "sarvam",
        "typecast",
        "xai",
      ]),
    );
    expect(
      Object.keys(ASR_PRESETS).filter((vendor) => vendor !== "transcribe"),
    ).toEqual(
      expect.arrayContaining([
        "ares",
        "microsoft",
        "deepgram",
        "gemini",
        "openai",
        "google",
        "amazon",
        "assemblyai",
        "sarvam",
        "xai",
      ]),
    );
  });

  it("shows only managed OpenAI models and hides LLM credentials", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Credential mode", "Agora managed");

    expect(getSelectButton("Model")).toHaveTextContent("gpt-5-mini");
    expect(getSelectButton("Provider")).toHaveTextContent(
      "OpenAI",
    );
    fireEvent.click(getSelectButton("Provider"));
    expect(
      within(getOpenField("Provider")).getAllByRole("button", {
        name: "OpenAI",
      }),
    ).toHaveLength(2);
    expect(within(getOpenField("Provider")).queryByRole("button", { name: "Groq" })).not.toBeInTheDocument();
    fireEvent.click(
      within(getOpenField("Provider")).getAllByRole("button", {
        name: "OpenAI",
      })[1],
    );

    fireEvent.click(getSelectButton("Model"));
    for (const model of [
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-5-nano",
      "gpt-5-mini",
    ]) {
      expect(
        within(getOpenField("Model")).getAllByRole("button", { name: model })
          .length,
      ).toBeGreaterThanOrEqual(1);
    }
    expect(screen.queryByText("API URL", { selector: "label span" })).not.toBeInTheDocument();
    expect(screen.queryByText("API Key", { selector: "label span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Request headers (JSON)", { selector: "label span" })).not.toBeInTheDocument();
  });

  it("shows only MiniMax and OpenAI models in managed TTS", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }));
    chooseFromField("Credential mode", "Agora managed");

    expect(getSelectButton("Vendor")).toHaveTextContent(
      "MiniMax",
    );
    fireEvent.click(getSelectButton("Vendor"));
    expect(
      within(getOpenField("Vendor")).getAllByRole("button", {
        name: "MiniMax",
      }),
    ).toHaveLength(2);
    expect(within(getOpenField("Vendor")).getByRole("button", { name: "OpenAI" })).toBeInTheDocument();
    expect(within(getOpenField("Vendor")).queryByRole("button", { name: "ElevenLabs" })).not.toBeInTheDocument();
    fireEvent.click(
      within(getOpenField("Vendor")).getAllByRole("button", {
        name: "MiniMax",
      })[1],
    );

    fireEvent.click(getSelectButton("Model"));
    expect(
      within(getOpenField("Model")).getAllByRole("button", {
        name: "speech-2.6-turbo",
      }),
    ).toHaveLength(2);
    expect(within(getOpenField("Model")).getByRole("button", { name: "speech-2.8-turbo" })).toBeInTheDocument();
    expect(screen.queryByText("API Key", { selector: "label span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Provider parameters (JSON)", { selector: "label span" })).not.toBeInTheDocument();
  });

  it("offers the approved English and Hindi voices for managed MiniMax", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }),
    );
    chooseFromField("Credential mode", "Agora managed");

    expect(getSelectButton("Voice")).toHaveTextContent(
      "Captivating Female — English",
    );
    fireEvent.click(getSelectButton("Voice"));
    for (const voice of [
      "Captivating Female — English",
      "Trustworthy Man — English",
      "Expressive Narrator — English",
      "Trustworthy Advisor — Hindi",
      "Tranquil Woman — Hindi",
      "News Anchor — Hindi",
    ]) {
      expect(
        within(getOpenField("Voice")).getAllByRole("button", { name: voice })
          .length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows the default for an unsupported saved managed MiniMax voice", () => {
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      tts: {
        credential_mode: "managed",
        vendor: "minimax",
        params: {
          model: "speech-2.6-turbo",
          voice_setting: { voice_id: "account-specific-cloned-voice" },
        },
      },
    });

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }),
    );

    expect(getSelectButton("Voice")).toHaveTextContent(
      "Captivating Female — English",
    );
  });

  it("shows only Deepgram Nova models in managed ASR", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ASR \(Speech Recognition\)/i }));
    chooseFromField("Credential mode", "Agora managed");

    expect(getSelectButton("Vendor")).toHaveTextContent(
      "Deepgram",
    );
    fireEvent.click(getSelectButton("Vendor"));
    expect(within(getOpenField("Vendor")).getAllByRole("button")).toHaveLength(2);
    expect(within(getOpenField("Vendor")).queryByRole("button", { name: "ARES" })).not.toBeInTheDocument();
    fireEvent.click(
      within(getOpenField("Vendor")).getAllByRole("button", {
        name: "Deepgram",
      })[1],
    );

    fireEvent.click(getSelectButton("Model"));
    expect(within(getOpenField("Model")).getByRole("button", { name: "nova-2" })).toBeInTheDocument();
    expect(
      within(getOpenField("Model")).getAllByRole("button", { name: "nova-3" }),
    ).toHaveLength(2);
    expect(screen.queryByText("API Key", { selector: "label span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Provider parameters (JSON)", { selector: "label span" })).not.toBeInTheDocument();
  });

  it("configures the documented Gemini ASR preview defaults in BYOK mode", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /ASR \(Speech Recognition\)/i }),
    );
    chooseFromField("Vendor", "Google Gemini (Early Access)");

    expect(screen.getByText(/Gemini ASR uses Agora's early-access preview/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Gemini API Key")).toBeInTheDocument();
    expect(getSelectButton("Model")).toHaveTextContent(
      "gemini-3.5-transcribe-live",
    );
    expect(screen.getByLabelText("Sample rate")).toHaveValue(16000);
    expect(screen.getByRole("switch", { name: "Word timestamps" })).toBeChecked();
    chooseFromField("Language", "Hindi (hi-IN)");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].asr).toEqual({
      credential_mode: "byok",
      vendor: "gemini",
      language: "hi-IN",
      params: {
        api_key: "",
        model: "gemini-3.5-transcribe-live",
        sample_rate: 16000,
        language: "hi-IN",
        word_timestamp: true,
      },
    });
  });

  it("restores the previous LLM BYOK draft after a managed-mode round trip", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Groq");
    chooseFromField("Credential mode", "Agora managed");
    chooseFromField("Credential mode", "Bring your own key (BYOK)");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      credential_mode: "byok",
      vendor: "custom",
      url: "https://api.groq.com/openai/v1/chat/completions",
      params: { model: "llama-3.3-70b-versatile" },
    });
  });
});
