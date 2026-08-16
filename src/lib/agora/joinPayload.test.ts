import { describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import {
  buildJoinProperties,
  buildMaskedJoinPreview,
  validateAgentSettings,
} from "./joinPayload";

const runtime = {
  channel: "channel-a",
  token: "agent-token",
  agentRtcUid: "0",
  remoteRtcUids: ["42"],
  username: "Ada",
};

function settings(overrides: Partial<AgentSettings> = {}): AgentSettings {
  return {
    name: "agent-a",
    llm: {
      credential_mode: "byok",
      vendor: "custom",
      url: "https://llm.example.test/v1/chat/completions",
      api_key: "llm-secret",
      params: { model: "model-a" },
    },
    tts: {
      credential_mode: "byok",
      vendor: "openai",
      params: { key: "tts-secret", model: "tts-1", voice: "alloy" },
    },
    asr: { vendor: "ares", language: "en-US", params: {} },
    advanced_features: { enable_rtm: false },
    ...overrides,
  };
}

describe("buildJoinProperties", () => {
  it("preserves idle timeout zero and emits current parameter names", () => {
    const properties = buildJoinProperties({
      settings: settings({
        idle_timeout: 0,
        parameters: {
          data_channel: "datastream",
          enable_metrics: true,
          enable_error_message: true,
          opt_out: true,
          farewell_config: {
            graceful_enabled: true,
            graceful_timeout_seconds: 10,
          },
        },
      }),
      runtime,
    });

    expect(properties.idle_timeout).toBe(0);
    expect(properties.parameters).toEqual({
      data_channel: "datastream",
      enable_metrics: true,
      enable_error_message: true,
      opt_out: true,
      farewell_config: {
        graceful_enabled: true,
        graceful_timeout_seconds: 10,
      },
    });
  });

  it("emits current greeting, credential, TTS, and ASR fields", () => {
    const properties = buildJoinProperties({
      settings: settings({
        llm: {
          credential_mode: "managed",
          vendor: "openai",
          url: "https://llm.example.test",
          api_key: "",
          greeting_message: "Welcome",
          greeting_audio_url: "https://cdn.example.test/welcome.pcm",
          greeting_configs: {
            mode: "single_first",
            delay_ms: 250,
            interruptable: false,
            audio_download_timeout_ms: 3000,
            audio_pcm_sample_rate: 24000,
          },
          params: { model: "managed-model" },
        },
        tts: {
          credential_mode: "byok",
          vendor: "generic_http",
          url: "https://tts.example.test/v1/audio/speech",
          headers: { Authorization: "Bearer tts-secret" },
          params: { model: "voice-model", voice: "voice-a" },
          skip_patterns: [1, 2],
        },
        asr: {
          credential_mode: "managed",
          vendor: "ares",
          language: "en-US",
          keywords: ["Agora", "ConvoAI"],
          params: {},
        },
      }),
      runtime,
    });

    expect(properties.llm).toMatchObject({
      credential_mode: "managed",
      vendor: "openai",
      greeting_audio_url: "https://cdn.example.test/welcome.pcm",
      greeting_configs: {
        mode: "single_first",
        delay_ms: 250,
        interruptable: false,
        audio_download_timeout_ms: 3000,
        audio_pcm_sample_rate: 24000,
      },
      template_variables: { username: "Ada" },
    });
    expect(properties.tts).toEqual({
      credential_mode: "byok",
      vendor: "generic_http",
      url: "https://tts.example.test/v1/audio/speech",
      headers: { Authorization: "Bearer tts-secret" },
      params: { model: "voice-model", voice: "voice-a" },
      skip_patterns: [1, 2],
    });
    expect(properties.asr).toEqual({
      credential_mode: "managed",
      vendor: "ares",
      language: "en-US",
      keywords: ["Agora", "ConvoAI"],
      params: {},
    });
  });

  it("adds the default voice to managed MiniMax TTS", () => {
    const properties = buildJoinProperties({
      settings: settings({
        tts: {
          credential_mode: "managed",
          vendor: "minimax",
          params: { model: "speech-2.6-turbo" },
        },
      }),
      runtime,
    });

    expect(properties.tts).toMatchObject({
      credential_mode: "managed",
      vendor: "minimax",
      params: {
        model: "speech-2.6-turbo",
        voice_setting: {
          voice_id: "English_captivating_female1",
        },
      },
    });
  });

  it("adds the required endpoint to managed OpenAI TTS", () => {
    const properties = buildJoinProperties({
      settings: settings({
        tts: {
          credential_mode: "managed",
          vendor: "openai",
          params: { model: "tts-1", voice: "alloy" },
        },
      }),
      runtime,
    });

    expect(properties.tts).toMatchObject({
      credential_mode: "managed",
      vendor: "openai",
      params: {
        model: "tts-1",
        voice: "alloy",
        url: "https://api.openai.com/v1/audio/speech",
      },
    });
  });

  it("emits v2.11 MLLM without cascade modules or deprecated flags", () => {
    const properties = buildJoinProperties({
      settings: settings({
        mllm: {
          enable: true,
          vendor: "azure",
          url: "wss://azure.example.test/realtime",
          api_key: "mllm-secret",
          params: { model: "gpt-realtime" },
          turn_detection: {
            mode: "server_vad",
            server_vad_config: { threshold: 0.5 },
          },
        },
      }),
      runtime,
    });

    expect(properties.mllm).toEqual({
      enable: true,
      vendor: "azure",
      url: "wss://azure.example.test/realtime",
      api_key: "mllm-secret",
      params: { model: "gpt-realtime" },
      turn_detection: {
        mode: "server_vad",
        server_vad_config: { threshold: 0.5 },
      },
    });
    expect(properties).not.toHaveProperty("llm");
    expect(properties).not.toHaveProperty("tts");
    expect(properties).not.toHaveProperty("asr");
    expect(properties.advanced_features).not.toHaveProperty("enable_mllm");
  });

  it("emits manual turn detection and current interruption separately", () => {
    const properties = buildJoinProperties({
      settings: settings({
        enable_turn_detection: true,
        turn_detection: {
          mode: "default",
          config: {
            start_of_speech: { mode: "manual" },
            end_of_speech: { mode: "vad", vad_config: { silence_duration_ms: 640 } },
          },
        },
        interruption: {
          enable: true,
          mode: "keywords",
          keywords_config: { trigger_keywords: ["stop now"] },
        },
        advanced_features: { enable_rtm: true },
      }),
      runtime,
    });

    expect(properties.turn_detection).toEqual({
      mode: "default",
      config: {
        start_of_speech: { mode: "manual" },
        end_of_speech: {
          mode: "vad",
          vad_config: { silence_duration_ms: 640 },
        },
      },
    });
    expect(properties.interruption).toEqual({
      enable: true,
      mode: "keywords",
      keywords_config: { trigger_keywords: ["stop now"] },
    });
    expect(properties.parameters).toEqual({ data_channel: "rtm" });
  });

  it("emits current geofence and MLLM message/modalities fields", () => {
    const properties = buildJoinProperties({
      settings: settings({
        geofence: { area: "GLOBAL", exclude_area: "EUROPE" },
        mllm: {
          enable: true,
          vendor: "azure",
          api_key: "mllm-key",
          messages: [{ type: "message", role: "system", content: [] }],
          input_modalities: ["audio", "text"],
          output_modalities: ["text", "audio"],
        },
      }),
      runtime,
    });

    expect(properties.geofence).toEqual({
      area: "GLOBAL",
      exclude_area: "EUROPE",
    });
    expect(properties.mllm).toMatchObject({
      messages: [{ type: "message", role: "system", content: [] }],
      input_modalities: ["audio", "text"],
      output_modalities: ["text", "audio"],
    });
  });

  it("normalizes enabled MCP servers and strips UI-only fields", () => {
    const properties = buildJoinProperties({
      settings: settings({
        llm: {
          url: "https://llm.example.test",
          api_key: "llm-secret",
          params: { model: "model-a" },
          mcp_servers: [
            {
              name: "Weather",
              endpoint: "https://mcp.example.test/mcp",
              transport: "streamable_http",
              queries: { city: "London" },
              allowed_tools: ["forecast"],
              enabled: true,
            },
            {
              name: "Disabled",
              endpoint: "https://disabled.example.test/mcp",
              transport: "streamable_http",
              enabled: false,
            },
          ],
        },
      }),
      runtime,
    });

    expect(properties.llm).toMatchObject({
      mcp_servers: [
        {
          name: "Weather",
          endpoint: "https://mcp.example.test/mcp?city=London",
          transport: "streamable_http",
          allowed_tools: ["forecast"],
        },
      ],
    });
    expect(properties.advanced_features).toMatchObject({ enable_tools: true });
  });
});

describe("validateAgentSettings", () => {
  it("rejects unsupported managed ASR, LLM, and TTS combinations", () => {
    const result = validateAgentSettings(
      settings({
        llm: {
          credential_mode: "managed",
          vendor: "custom",
          url: "https://api.groq.com/openai/v1/chat/completions",
          api_key: "",
          params: { model: "llama-3.3-70b-versatile" },
        },
        tts: {
          credential_mode: "managed",
          vendor: "elevenlabs",
          params: { model: "eleven_flash_v2_5" },
        },
        asr: {
          credential_mode: "managed",
          vendor: "ares",
          language: "en-US",
          params: { model: "nova-3" },
        },
      }),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "llm",
          code: "managed_llm_provider_model",
        }),
        expect.objectContaining({
          path: "tts",
          code: "managed_tts_provider_model",
        }),
        expect.objectContaining({
          path: "asr",
          code: "managed_asr_provider_model",
        }),
      ]),
    );
  });

  it("accepts every category when its managed combination is supported", () => {
    const result = validateAgentSettings(
      settings({
        llm: {
          credential_mode: "managed",
          vendor: "openai",
          url: "https://api.openai.com/v1/chat/completions",
          api_key: "",
          params: { model: "gpt-5-mini" },
        },
        tts: {
          credential_mode: "managed",
          vendor: "minimax",
          params: { model: "speech-2.8-turbo" },
        },
        asr: {
          credential_mode: "managed",
          vendor: "deepgram",
          language: "en-US",
          params: { model: "nova-2" },
        },
      }),
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("does not restrict provider and model combinations in BYOK mode", () => {
    const result = validateAgentSettings(
      settings({
        llm: {
          credential_mode: "byok",
          vendor: "custom",
          url: "https://api.groq.com/openai/v1/chat/completions",
          api_key: "groq-secret",
          params: { model: "llama-3.3-70b-versatile" },
        },
        tts: {
          credential_mode: "byok",
          vendor: "elevenlabs",
          params: { key: "secret", model_id: "eleven_flash_v2_5" },
        },
        asr: {
          credential_mode: "byok",
          vendor: "microsoft",
          language: "en-US",
          params: { key: "secret", region: "eastus" },
        },
      }),
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects ARES keywords on another ASR vendor", () => {
    const result = validateAgentSettings(
      settings({ asr: { vendor: "deepgram", keywords: ["Agora"], params: {} } }),
    );

    expect(result.errors).toContainEqual({
      path: "asr.keywords",
      code: "ares_keywords_vendor",
      message: "ASR keywords are supported only when the vendor is ARES.",
    });
  });

  it("rejects manual turn detection when RTM is disabled", () => {
    const result = validateAgentSettings(
      settings({
        enable_turn_detection: true,
        turn_detection: {
          mode: "default",
          config: { start_of_speech: { mode: "manual" } },
        },
        advanced_features: { enable_rtm: false },
      }),
    );

    expect(result.errors).toContainEqual({
      path: "turn_detection.config.start_of_speech.mode",
      code: "manual_turn_requires_rtm",
      message: "Manual turn detection requires RTM and the RTM data channel.",
    });
  });

  it("also requires RTM for manual end-of-speech", () => {
    const result = validateAgentSettings(
      settings({
        enable_turn_detection: true,
        turn_detection: {
          mode: "default",
          config: { end_of_speech: { mode: "manual" } },
        },
        advanced_features: { enable_rtm: false },
      }),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "manual_turn_requires_rtm" }),
    );
  });

  it("validates current lifecycle, greeting, silence, and geofence limits", () => {
    const result = validateAgentSettings(
      settings({
        idle_timeout: 259201,
        geofence: { area: "INDIA", exclude_area: "EUROPE" },
        llm: {
          url: "https://llm.example.test",
          api_key: "",
          greeting_audio_url: "ftp://example.test/greeting.wav",
          greeting_configs: { audio_download_timeout_ms: 10001 },
        },
        parameters: {
          silence_config: { action: "think", timeout_ms: 60001 },
        },
      }),
    );

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "idle_timeout_range",
        "geofence_exclusion",
        "greeting_audio_url",
        "greeting_audio_fallback",
        "greeting_download_timeout",
        "silence_timeout_range",
        "silence_content_required",
      ]),
    );
  });
});

describe("buildMaskedJoinPreview", () => {
  it("masks tokens, provider keys, and authorization headers", () => {
    const preview = buildMaskedJoinPreview({
      settings: settings({
        tts: {
          vendor: "generic_http",
          url: "https://tts.example.test",
          headers: { Authorization: "Bearer secret" },
          params: { api_key: "nested-secret" },
        },
      }),
      runtime,
    });

    expect(preview.token).toBe("***MASKED***");
    expect((preview.llm as Record<string, unknown>).api_key).toBe("***MASKED***");
    expect((preview.tts as { headers: Record<string, string> }).headers.Authorization).toBe("***MASKED***");
    expect((preview.tts as { params: Record<string, string> }).params.api_key).toBe("***MASKED***");
  });
});
