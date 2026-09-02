import { describe, expect, it } from "vitest";
import { hydrateAgentProviderCredentials } from "./agentProviderCredentials";

describe("hydrateAgentProviderCredentials", () => {
  it("injects server keys into blank BYOK provider fields", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        llm: { vendor: "openai", api_key: "" },
        tts: { vendor: "elevenlabs", params: { key: "" } },
        asr: { vendor: "deepgram", params: { api_key: "" } },
      },
      {
        LLM_API_KEY: "llm-secret",
        ELEVENLABS_API_KEY: "tts-secret",
        DEEPGRAM_API_KEY: "asr-secret",
      },
    );

    expect(hydrated).toMatchObject({
      llm: { api_key: "llm-secret" },
      tts: { params: { key: "tts-secret" } },
      asr: { params: { api_key: "asr-secret" } },
    });
  });

  it("does not inject credentials into managed providers", () => {
    const input = {
      llm: { vendor: "openai", credential_mode: "managed", api_key: "" },
      tts: {
        vendor: "minimax",
        credential_mode: "managed",
        params: { key: "" },
      },
      asr: {
        vendor: "deepgram",
        credential_mode: "managed",
        params: { api_key: "" },
      },
    };

    expect(
      hydrateAgentProviderCredentials(input, {
        LLM_API_KEY: "llm-secret",
        ELEVENLABS_API_KEY: "tts-secret",
        DEEPGRAM_API_KEY: "asr-secret",
      }),
    ).toEqual(input);
  });

  it("preserves explicit user credentials and does not mutate input", () => {
    const input = {
      llm: { vendor: "openai", api_key: "user-key" },
    };

    const hydrated = hydrateAgentProviderCredentials(input, {
      LLM_API_KEY: "server-key",
    });

    expect(hydrated).toEqual(input);
    expect(hydrated).not.toBe(input);
  });

  it("injects the dedicated OpenAI ASR key into params.api_key", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        asr: {
          vendor: "openai",
          credential_mode: "byok",
          params: {
            api_key: "",
            input_audio_transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "en",
            },
          },
        },
      },
      {
        NODE_ENV: "test",
        OPENAI_ASR_KEY: "openai-asr-secret",
        OPENAI_API_KEY: "shared-openai-secret",
      },
    );

    expect(hydrated).toMatchObject({
      asr: {
        params: {
          api_key: "openai-asr-secret",
          input_audio_transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
          },
        },
      },
    });
  });

  it("falls back to the shared OpenAI key for OpenAI ASR", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        asr: {
          vendor: "openai",
          credential_mode: "byok",
          params: { api_key: "" },
        },
      },
      { NODE_ENV: "test", OPENAI_API_KEY: "shared-openai-secret" },
    );

    expect(hydrated).toMatchObject({
      asr: { params: { api_key: "shared-openai-secret" } },
    });
  });

  it("maps the protected TTS key to Sarvam's documented credential field", () => {
    const hydrated = hydrateAgentProviderCredentials({
      tts: {
        vendor: "sarvam",
        credential_mode: "byok",
        params: {
          key: "sarvam-secret",
          model: "bulbul:v2",
          speaker: "anushka",
          target_language_code: "en-IN",
        },
      },
    });

    expect(hydrated).toMatchObject({
      tts: {
        params: {
          api_subscription_key: "sarvam-secret",
          model: "bulbul:v2",
          speaker: "anushka",
          target_language_code: "en-IN",
        },
      },
    });
    expect(
      (hydrated.tts as { params: Record<string, unknown> }).params,
    ).not.toHaveProperty("key");
  });

  it("prefers a newly entered Sarvam key over an imported credential", () => {
    const hydrated = hydrateAgentProviderCredentials({
      tts: {
        vendor: "sarvam",
        credential_mode: "byok",
        params: {
          key: "new-sarvam-secret",
          api_subscription_key: "old-sarvam-secret",
        },
      },
    });

    expect(hydrated).toMatchObject({
      tts: {
        params: { api_subscription_key: "new-sarvam-secret" },
      },
    });
  });
});
