import { describe, expect, it } from "vitest";
import { sanitizeCustomJoinPayload } from "./customPayloadSanitize";

describe("sanitizeCustomJoinPayload v2.11 normalization", () => {
  it("translates legacy custom fields without dropping provider params", () => {
    const normalized = sanitizeCustomJoinPayload({
      name: "custom-agent",
      properties: {
        llm: {
          url: "https://llm.example.test",
          api_key: "***MASKED***",
          future_provider_option: { enabled: true },
          mcp_servers: [
            {
              name: "Weather",
              endpoint: "https://mcp.example.test",
              transport: "http",
            },
          ],
        },
        tts: { vendor: "polly", params: { voice: "Joanna" } },
        turn_detection: {
          mode: "default",
          config: {
            start_of_speech: {
              mode: "disabled",
              disabled_config: { strategy: "ignored" },
            },
          },
        },
        advanced_features: { enable_mllm: false, enable_rtm: false },
        parameters: { data_channel: "rtc", enable_farewell: true },
      },
    });

    expect(normalized?.properties).toMatchObject({
      llm: { future_provider_option: { enabled: true } },
      tts: { vendor: "amazon", params: { voice: "Joanna" } },
      interruption: {
        enable: false,
        disabled_config: { strategy: "ignore" },
      },
      parameters: {
        data_channel: "datastream",
        farewell_config: { graceful_enabled: true },
      },
    });
    expect(normalized?.properties).not.toHaveProperty("schemaVersion");
    expect(normalized?.properties.advanced_features).not.toHaveProperty(
      "enable_mllm",
    );
    expect(
      (
        normalized?.properties.llm as {
          mcp_servers: Array<{ transport: string }>;
        }
      ).mcp_servers[0].transport,
    ).toBe("streamable_http");
  });

  it("keeps current long-tail providers available to Custom JSON", () => {
    const normalized = sanitizeCustomJoinPayload({
      name: "typecast-agent",
      properties: {
        llm: {
          credential_mode: "managed",
          vendor: "custom",
          url: "https://llm.example.test",
          params: { model: "model-a" },
        },
        tts: {
          credential_mode: "byok",
          vendor: "typecast",
          params: { voice_id: "voice-a", emotion: "happy" },
        },
        asr: { vendor: "xai", params: { model: "grok-asr" } },
      },
    });

    expect(normalized?.properties).toMatchObject({
      tts: {
        vendor: "typecast",
        params: { voice_id: "voice-a", emotion: "happy" },
      },
      asr: { vendor: "xai", params: { model: "grok-asr" } },
    });
  });
});
