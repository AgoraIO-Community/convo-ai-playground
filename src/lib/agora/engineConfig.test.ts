import { describe, expect, it } from "vitest";
import {
  ENGINE_SETTINGS_SCHEMA_VERSION,
  migrateAgentSettings,
} from "./engineConfig";

describe("migrateAgentSettings", () => {
  it("moves legacy disabled SoS behavior into top-level interruption", () => {
    const migrated = migrateAgentSettings({
      name: "legacy-agent",
      llm: { url: "https://llm.example.test", api_key: "" },
      tts: { vendor: "openai", params: {} },
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
    });

    expect(migrated.interruption).toEqual({
      enable: false,
      disabled_config: { strategy: "ignore" },
    });
    expect(migrated.turn_detection?.config?.start_of_speech).toBeUndefined();
    expect(migrated.parameters?.data_channel).toBe("datastream");
    expect(migrated.parameters?.farewell_config).toEqual({
      graceful_enabled: true,
    });
    expect(migrated.parameters).not.toHaveProperty("enable_farewell");
    expect(migrated.advanced_features).not.toHaveProperty("enable_mllm");
  });

  it("moves legacy keyword SoS phrases to interruption keywords", () => {
    const migrated = migrateAgentSettings({
      name: "keyword-agent",
      llm: { url: "https://llm.example.test", api_key: "" },
      tts: { vendor: "openai", params: {} },
      turn_detection: {
        mode: "default",
        config: {
          start_of_speech: {
            mode: "keywords",
            keywords_config: {
              interrupt_duration_ms: 240,
              prefix_padding_ms: 600,
              triggered_keywords: ["excuse me", "stop"],
            },
          },
        },
      },
    });

    expect(migrated.interruption).toEqual({
      enable: true,
      mode: "keywords",
      keywords_config: {
        trigger_keywords: ["excuse me", "stop"],
      },
    });
    expect(migrated.turn_detection?.config?.start_of_speech).toBeUndefined();
  });

  it("migrates legacy MLLM style to enable and vendor", () => {
    const migrated = migrateAgentSettings({
      name: "mllm-agent",
      llm: { url: "https://llm.example.test", api_key: "" },
      tts: { vendor: "openai", params: {} },
      advanced_features: { enable_mllm: true },
      mllm: {
        style: "openai",
        params: { model: "gpt-realtime" },
        turn_detection: {
          provider: "openai",
          openai: { type: "server_vad", threshold: 0.6 },
        },
      },
    });

    expect(migrated.mllm).toMatchObject({
      enable: true,
      vendor: "openai",
      params: { model: "gpt-realtime" },
      turn_detection: {
        mode: "server_vad",
        server_vad_config: { threshold: 0.6 },
      },
    });
    expect(migrated.mllm).not.toHaveProperty("style");
    expect(migrated.advanced_features).not.toHaveProperty("enable_mllm");
  });

  it("normalizes renamed vendors and MCP transport without dropping params", () => {
    const migrated = migrateAgentSettings({
      name: "aliases-agent",
      llm: {
        url: "https://llm.example.test",
        api_key: "",
        mcp_servers: [
          {
            name: "Weather",
            endpoint: "https://mcp.example.test",
            transport: "http",
            params_from_future_version: true,
          },
        ],
      },
      tts: {
        vendor: "fish_audio",
        params: { voice_id: "voice-1", future_option: 7 },
      },
      asr: { vendor: "transcribe", params: { region: "us-east-1" } },
    });

    expect(migrated.tts).toEqual({
      vendor: "fishaudio",
      params: { voice_id: "voice-1", future_option: 7 },
    });
    expect(migrated.asr?.vendor).toBe("amazon");
    expect(migrated.llm.mcp_servers?.[0]).toMatchObject({
      transport: "streamable_http",
      params_from_future_version: true,
    });
  });

  it("migrates legacy LLM headers, MLLM prompts, and silence disable values", () => {
    const migrated = migrateAgentSettings({
      name: "contract-agent",
      llm: {
        url: "https://llm.example.test",
        api_key: "",
        headers: '{"X-Tenant":"tenant-a"}',
      },
      tts: { vendor: "openai", params: {} },
      mllm: {
        enable: true,
        vendor: "openai",
        system_messages: [{ role: "system", content: "Be concise" }],
        headers: "legacy-header",
        failure_message: "legacy-failure",
        max_history: 9,
      },
      parameters: {
        silence_config: { action: "none", timeout_ms: 5000 },
      },
    });

    expect(migrated.llm.headers).toEqual({ "X-Tenant": "tenant-a" });
    expect(migrated.mllm?.messages).toEqual([
      {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: "Be concise" }],
      },
    ]);
    expect(migrated.mllm).not.toHaveProperty("system_messages");
    expect(migrated.mllm).not.toHaveProperty("headers");
    expect(migrated.mllm).not.toHaveProperty("failure_message");
    expect(migrated.mllm).not.toHaveProperty("max_history");
    expect(migrated.parameters?.silence_config).toEqual({
      action: "speak",
      timeout_ms: 0,
    });
  });

  it("is idempotent for current settings", () => {
    const current = migrateAgentSettings({
      schemaVersion: ENGINE_SETTINGS_SCHEMA_VERSION,
      name: "current-agent",
      llm: { url: "https://llm.example.test", api_key: "" },
      tts: { vendor: "openai", params: {} },
      parameters: { data_channel: "rtm", opt_out: true },
      interruption: { enable: true, mode: "start_of_speech" },
    });

    expect(migrateAgentSettings(current)).toEqual(current);
    expect(current.schemaVersion).toBe(ENGINE_SETTINGS_SCHEMA_VERSION);
  });
});
