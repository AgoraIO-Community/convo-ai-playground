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
import SettingsSidebar, {
  getDefaultASRConfig,
  getDefaultSettings,
} from "./SettingsSidebar";

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

describe("SettingsSidebar provider defaults", () => {
  it("starts first-time agents with the BYOK telephony-compatible stack", () => {
    const defaults = getDefaultSettings();

    expect(defaults.llm).toMatchObject({
      credential_mode: "byok",
      vendor: "openai",
      api_key: "",
    });
    expect(defaults.tts).toMatchObject({
      credential_mode: "byok",
      vendor: "elevenlabs",
      params: { key: "" },
    });
    expect(defaults.asr).toMatchObject({
      credential_mode: "byok",
      vendor: "deepgram",
      params: { api_key: "" },
    });
  });
});

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
    expect(onSave.mock.calls[0][0].llm.vendor).toBe("openai");
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

  it("presents speech pipeline sections in input-to-output order", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    const sections = [
      screen.getByRole("button", { name: /ASR \(Speech Recognition\)/i }),
      screen.getByRole("button", { name: /LLM Configuration/i }),
      screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }),
      screen.getByRole("button", { name: /MLLM \(Realtime voice\)/i }),
      screen.getByRole("button", { name: /AI Avatar \(Optional\)/i }),
      screen.getByRole("button", { name: /Conversation turns/i }),
      screen.getByRole("button", { name: /Advanced Settings/i }),
    ];

    sections.forEach((section, index) => {
      expect(section.parentElement).toHaveStyle({ order: index + 1 });
    });
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
      screen.getByRole("tab", { name: "Telephony" }),
    ).toBeInTheDocument();
  });

  it("keeps settings navigation accessible and non-wrapping", () => {
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    const aiTab = screen.getByRole("tab", { name: "AI Agent" });
    expect(aiTab).toHaveAttribute("aria-selected", "true");
    expect(aiTab).toHaveClass("whitespace-nowrap");
    expect(screen.getByTestId("settings-tab-list")).toHaveClass(
      "overflow-x-auto",
    );
    expect(within(aiTab).getByTestId("agent-glyph")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voice" }));
    expect(screen.getByRole("tab", { name: "Voice" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
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

  it("configures the documented Amazon Bedrock LLM fields", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Amazon Bedrock");
    fireEvent.change(screen.getByLabelText("AWS Access Key ID"), {
      target: { value: "aws-access-key" },
    });
    fireEvent.change(screen.getByLabelText("AWS Secret Access Key"), {
      target: { value: "aws-secret-key" },
    });
    fireEvent.change(screen.getByLabelText("AWS Region"), {
      target: { value: "ap-south-1" },
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "amazon.nova-lite-v1:0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      style: "bedrock",
      access_key: "aws-access-key",
      secret_key: "aws-secret-key",
      region: "ap-south-1",
      model: "amazon.nova-lite-v1:0",
      url: "https://bedrock-runtime.ap-south-1.amazonaws.com/model/amazon.nova-lite-v1:0/converse-stream",
    });
    expect(onSave.mock.calls[0][0].llm.vendor).toBeUndefined();
  });

  it("builds the Google Vertex AI streaming URL from its settings", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Google Vertex AI");
    fireEvent.change(screen.getByLabelText("Google Cloud project ID"), {
      target: { value: "example-project" },
    });
    fireEvent.change(screen.getByLabelText("Vertex AI location"), {
      target: { value: "europe-west4" },
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "gemini-2.0-flash-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      style: "gemini",
      url: "https://europe-west4-aiplatform.googleapis.com/v1/projects/example-project/locations/europe-west4/publishers/google/models/gemini-2.0-flash-001:streamGenerateContent?alt=sse",
      params: { model: "gemini-2.0-flash-001" },
      provider_config: {
        provider: "google_vertex_ai",
        project_id: "example-project",
        location: "europe-west4",
      },
    });
    expect(onSave.mock.calls[0][0].llm.vendor).toBeUndefined();
  });

  it("builds editable Sarvam Bulbul v2 provider placeholders", () => {
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
    chooseFromField("Vendor", "Sarvam");

    const paramsField = getOpenField("Provider parameters (JSON)");
    const paramsInput = within(paramsField).getByRole("textbox");
    expect(JSON.parse((paramsInput as HTMLTextAreaElement).value)).toEqual({
      model: "bulbul:v2",
      speaker: "",
      target_language_code: "",
      pace: 1,
      sample_rate: 24000,
    });
  });

  it("stores an OpenAI ASR key in params.api_key", async () => {
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
    chooseFromField("Vendor", "OpenAI Whisper (Beta)");
    chooseFromField("Language", "Hindi (hi-IN)");
    fireEvent.change(screen.getByLabelText("OpenAI ASR API Key"), {
      target: { value: "sk-openai-asr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].asr?.params).toMatchObject({
      api_key: "sk-openai-asr",
      input_audio_transcription: {
        model: "gpt-4o-mini-transcribe",
        prompt: "Transcribe the conversation accurately.",
        language: "hi",
      },
    });
  });

  it("hides and preserves TTS credentials in the provider JSON editor", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      tts: {
        credential_mode: "byok",
        vendor: "sarvam",
        params: {
          key: "sarvam-secret",
          model: "bulbul:v2",
          speaker: "anushka",
          target_language_code: "en-IN",
        },
      },
    });

    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }),
    );

    const paramsField = getOpenField("Provider parameters (JSON)");
    const paramsValue = (
      within(paramsField).getByRole("textbox") as HTMLTextAreaElement
    ).value;
    expect(paramsValue).not.toContain("sarvam-secret");
    expect(paramsValue).not.toContain('"key"');

    const paramsInput = within(paramsField).getByRole("textbox");
    fireEvent.change(paramsInput, {
      target: {
        value: JSON.stringify({
          model: "bulbul:v2",
          speaker: "shubh",
          target_language_code: "hi-IN",
        }),
      },
    });
    fireEvent.blur(paramsInput);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].tts.params).toMatchObject({
      key: "sarvam-secret",
      speaker: "shubh",
      target_language_code: "hi-IN",
    });
  });

  it("does not expose ASR credentials in the provider JSON editor", () => {
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      asr: {
        credential_mode: "byok",
        vendor: "openai",
        language: "en-US",
        params: {
          api_key: "openai-asr-secret",
          input_audio_transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
          },
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
      screen.getByRole("button", { name: /ASR \(Speech Recognition\)/i }),
    );

    const paramsField = getOpenField("Provider parameters (JSON)");
    const paramsValue = (
      within(paramsField).getByRole("textbox") as HTMLTextAreaElement
    ).value;
    expect(paramsValue).not.toContain("openai-asr-secret");
    expect(paramsValue).not.toContain('"api_key"');
  });

  it("preserves JSON credential entry for ASR vendors without a protected key field", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      asr: {
        credential_mode: "byok",
        vendor: "speechmatics",
        language: "en-US",
        params: { language: "en" },
      },
    });

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

    const paramsInput = within(
      getOpenField("Provider parameters (JSON)"),
    ).getByRole("textbox");
    fireEvent.change(paramsInput, {
      target: { value: JSON.stringify({ key: "speechmatics-secret" }) },
    });
    fireEvent.blur(paramsInput);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].asr?.params).toMatchObject({
      key: "speechmatics-secret",
    });
  });

  it("builds the documented OpenAI ASR defaults", () => {
    expect(getDefaultASRConfig("openai")).toMatchObject({
      vendor: "openai",
      params: {
        api_key: "",
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          prompt: "Transcribe the conversation accurately.",
          language: "en",
        },
      },
    });
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

  it("saves an exact custom OpenAI BYOK model ID", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Model", "Custom model ID");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Enter a custom OpenAI model ID.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Custom OpenAI model ID"), {
      target: { value: "gpt-5.7-preview" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm.params?.model).toBe("gpt-5.7-preview");
  });

  it("reopens an unknown stored OpenAI model as a custom ID", () => {
    useAppStore.getState().setAgentSettings({
      ...getDefaultSettings(),
      llm: {
        ...getDefaultSettings().llm,
        credential_mode: "byok",
        vendor: "openai",
        params: { model: "gpt-account-snapshot" },
      },
    });
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    expect(getSelectButton("Model")).toHaveTextContent("Custom model ID");
    expect(screen.getByLabelText("Custom OpenAI model ID")).toHaveValue(
      "gpt-account-snapshot",
    );
  });

  it("saves an exact custom Google Gemini BYOK model ID", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Google Gemini");
    chooseFromField("Model", "Custom model ID");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Enter a custom Google Gemini model ID.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Custom Google Gemini model ID"), {
      target: { value: "gemini-2.5-flash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      style: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      params: { model: "gemini-2.5-flash" },
    });
  });

  it("selects gemini-3.6-flash by default for Google Gemini", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Google Gemini");

    expect(getSelectButton("Model")).toHaveTextContent("gemini-3.6-flash");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      style: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse",
      params: { model: "gemini-3.6-flash" },
    });
  });

  it("selects claude-sonnet-4-6 by default for Anthropic Claude", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Anthropic Claude");

    expect(getSelectButton("Model")).toHaveTextContent("claude-sonnet-4-6");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm).toMatchObject({
      style: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      params: { model: "claude-sonnet-4-6" },
    });
  });

  it.each([
    ["Anthropic Claude", "anthropic"],
    ["Google Gemini", "gemini"],
    ["Groq", "openai"],
    ["Coze", "openai"],
    ["Dify", "dify"],
    ["MiniMax", "openai"],
    ["Amazon Bedrock", "bedrock"],
    ["Google Vertex AI", "gemini"],
  ])("does not mark the native %s provider as custom", async (provider, style) => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", provider);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm.vendor).toBeUndefined();
    expect(onSave.mock.calls[0][0].llm.style).toBe(style);
  });

  it("marks only the Custom LLM selection as vendor custom", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /LLM Configuration/i }));
    chooseFromField("Provider", "Custom (OpenAI-compatible)");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].llm.vendor).toBe("custom");
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

  it("configures MiniMax BYOK TTS and exposes voice cloning", async () => {
    const onSave = vi.fn<(settings: AgentSettings) => void>();
    render(
      <SettingsSidebar
        isOpen
        onClose={() => undefined}
        onSaveAgentSettings={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /TTS \(Text-to-Speech\)/i }),
    );
    chooseFromField("Vendor", "MiniMax");

    expect(screen.getByText("Clone a voice")).toBeInTheDocument();
    expect(screen.getByLabelText("MiniMax group ID")).toBeInTheDocument();
    expect(screen.getByLabelText("MiniMax model")).toHaveValue(
      "speech-2.8-turbo",
    );
    fireEvent.change(screen.getByLabelText("MiniMax group ID"), {
      target: { value: "group-123" },
    });
    fireEvent.change(screen.getByLabelText("MiniMax voice ID"), {
      target: { value: "MyVoice01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].tts).toMatchObject({
      credential_mode: "byok",
      vendor: "minimax",
      params: {
        group_id: "group-123",
        model: "speech-2.8-turbo",
        url: "wss://api-uw.minimax.io/ws/v1/t2a_v2",
        voice_setting: { voice_id: "MyVoice01", speed: 1 },
        audio_setting: { sample_rate: 44100 },
      },
    });
  });

  it("exposes instant voice cloning for ElevenLabs BYOK TTS", () => {
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

    expect(screen.getByText("ElevenLabs Instant Voice Cloning")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice name")).toBeInTheDocument();
  });

  it("refreshes provider JSON when an ElevenLabs clone selects a new voice ID", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        voiceId: "voice_clone_from_sidebar",
        requiresVerification: false,
        previewUrl: "data:audio/mpeg;base64,SUQz",
      }),
    );
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
    fireEvent.change(screen.getByLabelText("Voice name"), {
      target: { value: "Sidebar Clone" },
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

    await waitFor(() => {
      const paramsInput = within(
        getOpenField("Provider parameters (JSON)"),
      ).getByRole("textbox") as HTMLTextAreaElement;
      expect(JSON.parse(paramsInput.value)).toMatchObject({
        voice_id: "voice_clone_from_sidebar",
      });
    });
  });

  it("offers Deepgram, Fengming, and local-default choices in managed ASR", () => {
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
    expect(
      within(getOpenField("Vendor")).getByRole("button", {
        name: "Agora Fengming (China)",
      }),
    ).toBeInTheDocument();
    expect(
      within(getOpenField("Vendor")).getByRole("button", {
        name: "Local backend default (omit ASR)",
      }),
    ).toBeInTheDocument();
    expect(
      within(getOpenField("Vendor")).queryByRole("button", { name: "ARES" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(getOpenField("Vendor")).getAllByRole("button", {
        name: "Deepgram",
      })[1],
    );

    fireEvent.click(getSelectButton("Model"));
    expect(
      within(getOpenField("Model")).getAllByRole("button", { name: "nova-2" })
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(getOpenField("Model")).getAllByRole("button", { name: "nova-3" })
        .length,
    ).toBeGreaterThanOrEqual(1);
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
      url: "https://api.groq.com/openai/v1/chat/completions",
      params: { model: "llama-3.3-70b-versatile" },
    });
    expect(onSave.mock.calls[0][0].llm.vendor).toBeUndefined();
  });
});
