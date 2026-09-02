import { describe, expect, it } from "vitest";
import {
  decodeStoredAgentSettings,
  encodeStoredAgentSettings,
} from "./settingsDb";
import { ENGINE_SETTINGS_SCHEMA_VERSION } from "@/lib/agora/engineConfig";

describe("settingsDb agent record codec", () => {
  it("migrates an unversioned record when it is read", () => {
    const decoded = decodeStoredAgentSettings({
      id: "agent",
      value: {
        name: "legacy-agent",
        llm: { url: "https://llm.example.test", api_key: "***MASKED***" },
        tts: { vendor: "polly", params: { key: "***MASKED***" } },
        parameters: { data_channel: "rtc" },
      },
    });

    expect(decoded?.schemaVersion).toBe(ENGINE_SETTINGS_SCHEMA_VERSION);
    expect(decoded?.tts.vendor).toBe("amazon");
    expect(decoded?.parameters?.data_channel).toBe("datastream");
    expect(decoded?.llm.api_key).toBe("***MASKED***");
  });

  it("stores a versioned record with provider credentials masked", () => {
    const encoded = encodeStoredAgentSettings({
      name: "current-agent",
      schemaVersion: ENGINE_SETTINGS_SCHEMA_VERSION,
      llm: { url: "https://llm.example.test", api_key: "llm-secret" },
      tts: {
        vendor: "sarvam",
        params: {
          key: "tts-secret",
          api_subscription_key: "sarvam-secret",
        },
      },
      asr: { vendor: "deepgram", params: { api_key: "asr-secret" } },
    });

    expect(encoded.schemaVersion).toBe(ENGINE_SETTINGS_SCHEMA_VERSION);
    expect(encoded.value.llm.api_key).toBe("***MASKED***");
    expect(encoded.value.tts.params).toMatchObject({
      key: "***MASKED***",
      api_subscription_key: "***MASKED***",
    });
    expect(encoded.value.asr?.params).toMatchObject({
      api_key: "***MASKED***",
    });
  });
});
