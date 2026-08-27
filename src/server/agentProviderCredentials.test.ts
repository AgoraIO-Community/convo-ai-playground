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
});
