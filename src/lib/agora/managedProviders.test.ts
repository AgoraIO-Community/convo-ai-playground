import { describe, expect, it } from "vitest";
import type { ASRConfig, LLMConfig, TTSConfig } from "@/types/agora";
import {
  DEFAULT_MANAGED_MINIMAX_VOICE_ID,
  MANAGED_ASR_PROVIDERS,
  MANAGED_LLM_PROVIDERS,
  MANAGED_MINIMAX_VOICES,
  MANAGED_TTS_PROVIDERS,
  isSupportedManagedASR,
  isSupportedManagedLLM,
  isSupportedManagedTTS,
  normalizeManagedASR,
  normalizeManagedLLM,
  normalizeManagedTTS,
} from "./managedProviders";

describe("Agora managed provider catalog", () => {
  it("exposes the approved English and Hindi MiniMax system voices", () => {
    expect(DEFAULT_MANAGED_MINIMAX_VOICE_ID).toBe(
      "English_captivating_female1",
    );
    expect(MANAGED_MINIMAX_VOICES).toEqual([
      {
        value: "English_captivating_female1",
        label: "Captivating Female",
        language: "English",
      },
      {
        value: "English_Trustworth_Man",
        label: "Trustworthy Man",
        language: "English",
      },
      {
        value: "English_expressive_narrator",
        label: "Expressive Narrator",
        language: "English",
      },
      {
        value: "hindi_male_1_v2",
        label: "Trustworthy Advisor",
        language: "Hindi",
      },
      {
        value: "hindi_female_2_v1",
        label: "Tranquil Woman",
        language: "Hindi",
      },
      {
        value: "hindi_female_1_v2",
        label: "News Anchor",
        language: "Hindi",
      },
    ]);
  });

  it("exposes the documented managed provider and model combinations", () => {
    expect(MANAGED_ASR_PROVIDERS).toEqual({
      deepgram: {
        label: "Deepgram",
        defaultModel: "nova-3",
        models: ["nova-2", "nova-3"],
      },
      fengming: {
        label: "Agora Fengming (China)",
        defaultModel: "",
        models: [],
      },
    });
    expect(MANAGED_LLM_PROVIDERS).toEqual({
      openai: {
        label: "OpenAI",
        defaultModel: "gpt-5-mini",
        models: [
          "gpt-4o-mini",
          "gpt-4.1-mini",
          "gpt-5-nano",
          "gpt-5-mini",
        ],
      },
    });
    expect(MANAGED_TTS_PROVIDERS).toEqual({
      minimax: {
        label: "MiniMax",
        defaultModel: "speech-2.6-turbo",
        models: ["speech-2.6-turbo", "speech-2.8-turbo"],
      },
      openai: {
        label: "OpenAI",
        defaultModel: "tts-1",
        models: ["tts-1"],
      },
    });
  });
});

describe("managed provider normalization", () => {
  it("normalizes an unsupported LLM and removes BYOK credentials", () => {
    const llm: LLMConfig = {
      credential_mode: "byok",
      vendor: "custom",
      url: "https://api.groq.com/openai/v1/chat/completions",
      api_key: "groq-secret",
      headers: { Authorization: "Bearer groq-secret" },
      system_messages: [{ role: "system", content: "Be concise." }],
      params: { model: "llama-3.3-70b-versatile", temperature: 0.2 },
    };

    expect(normalizeManagedLLM(llm)).toEqual({
      credential_mode: "managed",
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      system_messages: [{ role: "system", content: "Be concise." }],
      params: { model: "gpt-5-mini", temperature: 0.2 },
      style: "openai",
    });
  });

  it("uses an explicitly requested supported managed LLM model", () => {
    const llm: LLMConfig = {
      credential_mode: "byok",
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "secret",
      params: { model: "gpt-4o-mini" },
    };

    expect(normalizeManagedLLM(llm, "gpt-5-mini").params?.model).toBe(
      "gpt-5-mini",
    );
  });

  it("keeps a supported OpenAI LLM model", () => {
    const llm: LLMConfig = {
      credential_mode: "byok",
      vendor: "openai",
      url: "https://proxy.example.test/chat",
      api_key: "secret",
      params: { model: "gpt-5-mini" },
    };

    expect(normalizeManagedLLM(llm).params?.model).toBe("gpt-5-mini");
  });

  it("normalizes unsupported TTS to MiniMax and removes key-bearing fields", () => {
    const tts: TTSConfig = {
      credential_mode: "byok",
      vendor: "elevenlabs",
      headers: { Authorization: "Bearer secret" },
      params: {
        key: "elevenlabs-secret",
        model_id: "eleven_flash_v2_5",
        voice_id: "voice-a",
      },
    };

    expect(normalizeManagedTTS(tts)).toEqual({
      credential_mode: "managed",
      vendor: "minimax",
      params: {
        model: "speech-2.6-turbo",
        url: "wss://api.minimax.io/ws/v1/t2a_v2",
        voice_setting: {
          voice_id: "English_captivating_female1",
        },
      },
    });
  });

  it("preserves a supported managed MiniMax voice", () => {
    const tts: TTSConfig = {
      credential_mode: "managed",
      vendor: "minimax",
      params: {
        model: "speech-2.8-turbo",
        voice_setting: {
          voice_id: "hindi_female_2_v1",
          speed: 1.1,
        },
      },
    };

    expect(normalizeManagedTTS(tts)).toMatchObject({
      params: {
        voice_setting: {
          voice_id: "hindi_female_2_v1",
          speed: 1.1,
        },
      },
    });
  });

  it("replaces an unsupported managed MiniMax voice with the default", () => {
    const tts: TTSConfig = {
      credential_mode: "managed",
      vendor: "minimax",
      params: {
        model: "speech-2.6-turbo",
        voice_setting: { voice_id: "account-specific-cloned-voice" },
      },
    };

    expect(normalizeManagedTTS(tts)).toMatchObject({
      params: {
        voice_setting: {
          voice_id: "English_captivating_female1",
        },
      },
    });
  });

  it("keeps the supported OpenAI voice while selecting tts-1", () => {
    const tts: TTSConfig = {
      credential_mode: "byok",
      vendor: "openai",
      params: { key: "secret", model: "tts-1-hd", voice: "nova" },
    };

    expect(normalizeManagedTTS(tts)).toEqual({
      credential_mode: "managed",
      vendor: "openai",
      params: {
        model: "tts-1",
        voice: "nova",
        url: "https://api.openai.com/v1/audio/speech",
      },
    });
  });

  it("uses an OpenAI voice default when changing managed TTS providers", () => {
    const tts: TTSConfig = {
      credential_mode: "managed",
      vendor: "minimax",
      params: { model: "speech-2.6-turbo" },
    };

    expect(normalizeManagedTTS(tts, "openai")).toEqual({
      credential_mode: "managed",
      vendor: "openai",
      params: {
        model: "tts-1",
        voice: "alloy",
        url: "https://api.openai.com/v1/audio/speech",
      },
    });
  });

  it("normalizes unsupported ASR to Deepgram and preserves language", () => {
    const asr: ASRConfig = {
      credential_mode: "byok",
      vendor: "microsoft",
      language: "en-IN",
      params: { key: "azure-secret", region: "centralindia" },
    };

    expect(normalizeManagedASR(asr)).toEqual({
      credential_mode: "managed",
      vendor: "deepgram",
      language: "en-IN",
      params: {
        model: "nova-3",
        url: "wss://api.deepgram.com/v1/listen",
        language: "en-IN",
      },
    });
  });

  it("normalizes Fengming as managed ASR without credentials or a model", () => {
    const asr: ASRConfig = {
      credential_mode: "byok",
      vendor: "deepgram",
      language: "en-US",
      params: { api_key: "deepgram-secret", model: "nova-3" },
    };

    expect(normalizeManagedASR(asr, "fengming")).toEqual({
      credential_mode: "managed",
      vendor: "fengming",
      language: "en-US",
    });
  });
});

describe("managed provider membership", () => {
  it("accepts only documented managed combinations", () => {
    expect(isSupportedManagedLLM("openai", "gpt-4.1-mini")).toBe(true);
    expect(isSupportedManagedLLM("custom", "gpt-4.1-mini")).toBe(false);
    expect(isSupportedManagedLLM("openai", "gpt-4o")).toBe(false);

    expect(isSupportedManagedTTS("minimax", "speech-2.8-turbo")).toBe(true);
    expect(isSupportedManagedTTS("openai", "tts-1")).toBe(true);
    expect(isSupportedManagedTTS("elevenlabs", "eleven_flash_v2_5")).toBe(false);

    expect(isSupportedManagedASR("deepgram", "nova-2")).toBe(true);
    expect(isSupportedManagedASR("fengming", undefined)).toBe(true);
    expect(isSupportedManagedASR("ares", "nova-2")).toBe(false);
    expect(isSupportedManagedASR("deepgram", "base")).toBe(false);
  });
});
