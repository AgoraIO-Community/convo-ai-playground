import { describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import { buildTelephonyAgentProperties } from "./telephonyAgentProperties";

function settings(): AgentSettings {
  return {
    name: "agent-test",
    llm: {
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      params: { model: "gpt-4o-mini" },
      mcp_servers: [
        {
          name: "Weather",
          endpoint: "https://weather.example/mcp",
          enabled: true,
          transport: "streamable_http",
        },
      ],
    },
    tts: {
      vendor: "elevenlabs",
      params: { key: "", voice_id: "voice-id" },
    },
    asr: {
      vendor: "deepgram",
      params: { api_key: "", model: "nova-3" },
    },
    advanced_features: { enable_rtm: false, enable_tools: true },
    parameters: { data_channel: "datastream" },
    avatar: {
      enable: true,
      vendor: "heygen",
      params: { api_key: "", avatar_id: "avatar-id" },
    },
  };
}

describe("buildTelephonyAgentProperties", () => {
  it("keeps the audio pipeline and removes browser RTC runtime fields", () => {
    const properties = buildTelephonyAgentProperties({
      settings: settings(),
      username: "Bhupendra",
      env: {
        LLM_API_KEY: "llm-secret",
        ELEVENLABS_API_KEY: "tts-secret",
        DEEPGRAM_API_KEY: "asr-secret",
      },
    });

    expect(properties).toMatchObject({
      llm: {
        api_key: "llm-secret",
        template_variables: { username: "Bhupendra" },
        mcp_servers: [
          {
            name: "Weather",
            endpoint: "https://weather.example/mcp",
            transport: "streamable_http",
          },
        ],
      },
      tts: { params: { key: "tts-secret", voice_id: "voice-id" } },
      asr: { params: { api_key: "asr-secret", model: "nova-3" } },
      advanced_features: { enable_tools: true },
      parameters: { data_channel: "datastream" },
    });
    expect(properties).not.toHaveProperty("channel");
    expect(properties).not.toHaveProperty("token");
    expect(properties).not.toHaveProperty("agent_rtc_uid");
    expect(properties).not.toHaveProperty("remote_rtc_uids");
    expect(properties).not.toHaveProperty("enable_string_uid");
    expect(properties).not.toHaveProperty("avatar");
  });

  it("rejects invalid current agent settings before dialing", () => {
    const invalid = settings();
    invalid.idle_timeout = -1;

    expect(() =>
      buildTelephonyAgentProperties({
        settings: invalid,
        username: "Bhupendra",
      }),
    ).toThrow("Idle timeout must be between 0 and 259200 seconds");
  });
});
