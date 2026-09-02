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

  it("hydrates and normalizes Amazon Bedrock credentials", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        llm: {
          credential_mode: "byok",
          vendor: "custom",
          style: "bedrock",
          api_key: "",
          access_key: "",
          secret_key: "",
          region: "ap-south-1",
          model: "amazon.nova-lite-v1:0",
          params: { model: "amazon.nova-lite-v1:0" },
          provider_config: { provider: "amazon_bedrock" },
        },
      },
      {
        BEDROCK_API_KEY: "bedrock-api-key",
        BEDROCK_AWS_ACCESS_KEY_ID: "aws-access-key",
        BEDROCK_AWS_SECRET_ACCESS_KEY: "aws-secret-key",
      },
    );

    expect(hydrated).toMatchObject({
      llm: {
        api_key: "bedrock-api-key",
        access_key: "aws-access-key",
        secret_key: "aws-secret-key",
        region: "ap-south-1",
        model: "amazon.nova-lite-v1:0",
      },
    });
    expect(hydrated.llm).not.toHaveProperty("provider_config");
    expect(hydrated.llm).not.toHaveProperty("params.model");
  });

  it("uses the server-side Google Vertex access token", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        llm: {
          credential_mode: "byok",
          vendor: "custom",
          style: "gemini",
          api_key: "",
          url: "https://us-central1-aiplatform.googleapis.com/v1/projects/example/locations/us-central1/publishers/google/models/gemini-2.0-flash-001:streamGenerateContent?alt=sse",
          params: { model: "gemini-2.0-flash-001" },
          provider_config: { provider: "google_vertex_ai" },
        },
      },
      { GOOGLE_VERTEX_ACCESS_TOKEN: "vertex-access-token" },
    );

    expect(hydrated).toMatchObject({
      llm: { api_key: "vertex-access-token" },
    });
    expect(hydrated.llm).not.toHaveProperty("provider_config");
  });

  it("places the Google Gemini API key in its native streaming URL", () => {
    const hydrated = hydrateAgentProviderCredentials(
      {
        llm: {
          credential_mode: "byok",
          vendor: "custom",
          style: "gemini",
          api_key: "",
          url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse",
          system_messages: [
            { role: "system", content: "You are a helpful assistant." },
          ],
          params: { model: "gemini-3.6-flash" },
        },
      },
      { NODE_ENV: "test", GEMINI_API_KEY: "gemini-secret" },
    );

    expect(hydrated.llm).toMatchObject({
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=gemini-secret",
      system_messages: [
        {
          role: "user",
          parts: [{ text: "You are a helpful assistant." }],
        },
      ],
    });
    expect(hydrated.llm).not.toHaveProperty("api_key");
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
