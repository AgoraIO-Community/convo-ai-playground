import type { AgentSettings } from "@/types/agora";
import { migrateAgentSettings } from "./engineConfig";
import {
  isSupportedManagedASR,
  isSupportedManagedLLM,
  isSupportedManagedTTS,
  normalizeManagedTTS,
} from "./managedProviders";

export interface JoinRuntimeValues {
  channel: string;
  token: string;
  agentRtcUid: string;
  remoteRtcUids: string[];
  username: string;
}

export interface JoinPayloadInput {
  settings: AgentSettings;
  runtime: JoinRuntimeValues;
}

export interface ValidationError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, compact(item)]),
  );
}

function buildMcpServers(settings: AgentSettings): Record<string, unknown>[] {
  return (settings.llm?.mcp_servers ?? [])
    .filter((server) => server.enabled !== false)
    .map((server) => {
      const queries = server.queries;
      const endpoint = server.endpoint;
      const rest = Object.fromEntries(
        Object.entries(server).filter(
          ([key]) => key !== "enabled" && key !== "queries" && key !== "endpoint",
        ),
      );
      let resolvedEndpoint = endpoint;
      if (queries && Object.keys(queries).length > 0) {
        const url = new URL(endpoint);
        for (const [key, value] of Object.entries(queries)) {
          url.searchParams.set(key, value);
        }
        resolvedEndpoint = url.toString();
      }
      return compact({
        ...rest,
        endpoint: resolvedEndpoint,
        transport: server.transport ?? "streamable_http",
      }) as Record<string, unknown>;
    });
}

function normalizeGeminiSystemMessages(
  messages: unknown,
): unknown {
  if (!Array.isArray(messages)) return messages;

  return messages.map((message) => {
    if (!isRecord(message)) return message;
    if (Array.isArray(message.parts)) return message;
    if (typeof message.content !== "string") return message;

    return {
      role: message.role === "system" ? "user" : message.role,
      parts: [{ text: message.content }],
    };
  });
}

function buildLlm(settings: AgentSettings, username: string): Record<string, unknown> {
  const llm = {
    ...clone(settings.llm),
    mcp_servers: undefined,
    provider_config: undefined,
  };
  if (llm.style === "gemini") {
    llm.system_messages = normalizeGeminiSystemMessages(llm.system_messages) as
      typeof llm.system_messages;
  }
  const mcpServers = buildMcpServers(settings);
  const enableRtm = settings.advanced_features?.enable_rtm === true;
  return compact({
    ...llm,
    input_modalities: enableRtm
      ? (llm.input_modalities ?? ["text", "image"])
      : ["text"],
    template_variables: {
      ...(llm.template_variables ?? {}),
      username: username || "Guest",
    },
    ...(mcpServers.length > 0 ? { mcp_servers: mcpServers } : {}),
  }) as Record<string, unknown>;
}

function buildAdvancedFeatures(
  settings: AgentSettings,
  hasMcpServers: boolean,
): Record<string, unknown> {
  const advanced = settings.advanced_features ?? {};
  return compact({
    enable_rtm: advanced.enable_rtm ?? false,
    enable_sal: advanced.enable_sal,
    enable_tools: settings.mllm?.enable
      ? false
      : Boolean(advanced.enable_tools || hasMcpServers),
  }) as Record<string, unknown>;
}

export function buildJoinProperties(
  input: JoinPayloadInput,
): Record<string, unknown> {
  const settings = migrateAgentSettings(input.settings);
  const useMllm = settings.mllm?.enable === true;
  const mcpServers = buildMcpServers(settings);
  const useRtm = settings.advanced_features?.enable_rtm === true;
  const parameters = compact({
    ...(settings.parameters ?? {}),
    data_channel: useRtm ? "rtm" : "datastream",
  }) as Record<string, unknown>;
  delete parameters.enable_farewell;
  delete parameters.farewell_phrases;

  const properties: Record<string, unknown> = {
    channel: input.runtime.channel,
    token: input.runtime.token,
    agent_rtc_uid: input.runtime.agentRtcUid,
    remote_rtc_uids: [...input.runtime.remoteRtcUids],
    enable_string_uid: false,
    idle_timeout: settings.idle_timeout ?? 30,
    advanced_features: buildAdvancedFeatures(settings, mcpServers.length > 0),
    parameters,
  };

  if (settings.geofence) {
    properties.geofence = compact(clone(settings.geofence));
  }

  if (useMllm) {
    const mllm = clone(settings.mllm!);
    delete (mllm as Record<string, unknown>).style;
    properties.mllm = compact(mllm);
  } else {
    properties.llm = buildLlm(settings, input.runtime.username);
    const tts =
      settings.tts.credential_mode === "managed"
        ? normalizeManagedTTS(settings.tts)
        : settings.tts;
    properties.tts = compact(clone(tts));
    if (settings.asr) properties.asr = compact(clone(settings.asr));
    if (settings.enable_turn_detection && settings.turn_detection) {
      properties.turn_detection = compact(clone(settings.turn_detection));
    }
    if (settings.filler_words?.enable) {
      properties.filler_words = compact(clone(settings.filler_words));
    }
  }

  if (settings.interruption) {
    properties.interruption = compact(clone(settings.interruption));
  }
  if (settings.advanced_features?.enable_sal && settings.sal) {
    properties.sal = compact(clone(settings.sal));
  }
  if (settings.avatar?.enable) {
    const vendor =
      settings.avatar.vendor === "heygen"
        ? "liveavatar"
        : settings.avatar.vendor === "lemonslice"
          ? "generic"
          : settings.avatar.vendor;
    properties.avatar = compact({
      ...clone(settings.avatar),
      vendor,
    });
  }

  return compact(properties) as Record<string, unknown>;
}

export function buildMaskedJoinPreview(
  input: JoinPayloadInput,
): Record<string, unknown> {
  const mask = (value: unknown, key = ""): unknown => {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === "token" ||
      normalizedKey === "agora_token" ||
      normalizedKey === "api_key" ||
      normalizedKey === "api_subscription_key" ||
      normalizedKey === "access_key" ||
      normalizedKey === "secret_key" ||
      normalizedKey === "key" ||
      normalizedKey === "authorization" ||
      normalizedKey.endsWith("_secret")
    ) {
      return typeof value === "string" && value.length > 0
        ? "***MASKED***"
        : value;
    }
    if (Array.isArray(value)) return value.map((item) => mask(item));
    if (!isRecord(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        mask(child, childKey),
      ]),
    );
  };
  return mask(buildJoinProperties(input)) as Record<string, unknown>;
}

export function validateAgentSettings(
  input: AgentSettings,
): ValidationResult {
  const settings = migrateAgentSettings(input);
  const errors: ValidationError[] = [];

  if (
    settings.llm?.credential_mode === "managed" &&
    !isSupportedManagedLLM(settings.llm.vendor, settings.llm.params?.model)
  ) {
    errors.push({
      path: "llm",
      code: "managed_llm_provider_model",
      message:
        "Agora managed LLM supports OpenAI gpt-4o-mini, gpt-4.1-mini, gpt-5-nano, or gpt-5-mini.",
    });
  }

  if (
    settings.tts?.credential_mode === "managed" &&
    !isSupportedManagedTTS(
      settings.tts.vendor,
      (settings.tts.params as Record<string, unknown>).model,
    )
  ) {
    errors.push({
      path: "tts",
      code: "managed_tts_provider_model",
      message:
        "Agora managed TTS supports MiniMax speech-2.6-turbo or speech-2.8-turbo, and OpenAI tts-1.",
    });
  }

  if (
    settings.asr?.credential_mode === "managed" &&
    !isSupportedManagedASR(
      settings.asr.vendor,
      (settings.asr.params as Record<string, unknown> | undefined)?.model,
    )
  ) {
    errors.push({
      path: "asr",
      code: "managed_asr_provider_model",
      message:
        "Agora managed ASR supports Deepgram nova-2 or nova-3, or Fengming in China.",
    });
  }

  if (
    settings.idle_timeout != null &&
    (settings.idle_timeout < 0 || settings.idle_timeout > 259200)
  ) {
    errors.push({
      path: "idle_timeout",
      code: "idle_timeout_range",
      message: "Idle timeout must be between 0 and 259200 seconds.",
    });
  }

  if (
    settings.geofence?.exclude_area &&
    settings.geofence.area !== "GLOBAL"
  ) {
    errors.push({
      path: "geofence.exclude_area",
      code: "geofence_exclusion",
      message: "A geofence exclusion can be used only with the GLOBAL area.",
    });
  }

  const greeting = settings.llm?.greeting_configs;
  if (settings.llm?.greeting_audio_url) {
    try {
      const url = new URL(settings.llm.greeting_audio_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      errors.push({
        path: "llm.greeting_audio_url",
        code: "greeting_audio_url",
        message: "Greeting audio must use a valid HTTP(S) URL.",
      });
    }
    if (!settings.llm.greeting_message?.trim()) {
      errors.push({
        path: "llm.greeting_message",
        code: "greeting_audio_fallback",
        message: "Greeting audio requires a greeting message as its TTS fallback.",
      });
    }
  }
  if (
    greeting?.audio_download_timeout_ms != null &&
    (greeting.audio_download_timeout_ms < 200 ||
      greeting.audio_download_timeout_ms > 10000)
  ) {
    errors.push({
      path: "llm.greeting_configs.audio_download_timeout_ms",
      code: "greeting_download_timeout",
      message: "Greeting audio download timeout must be between 200 and 10000 ms.",
    });
  }

  const silence = settings.parameters?.silence_config;
  if (
    silence?.timeout_ms != null &&
    (silence.timeout_ms < 0 || silence.timeout_ms > 60000)
  ) {
    errors.push({
      path: "parameters.silence_config.timeout_ms",
      code: "silence_timeout_range",
      message: "Silence timeout must be between 0 and 60000 ms.",
    });
  }
  if ((silence?.timeout_ms ?? 0) > 0 && !silence?.content?.trim()) {
    errors.push({
      path: "parameters.silence_config.content",
      code: "silence_content_required",
      message: "A silence reminder message is required when its timeout is enabled.",
    });
  }

  if (settings.tts?.vendor === "generic_http") {
    if (!settings.tts.url?.trim()) {
      errors.push({
        path: "tts.url",
        code: "generic_tts_url",
        message: "Generic HTTP TTS requires a service URL.",
      });
    }
    if (!settings.tts.headers || Object.keys(settings.tts.headers).length === 0) {
      errors.push({
        path: "tts.headers",
        code: "generic_tts_headers",
        message: "Generic HTTP TTS requires request headers.",
      });
    }
  }
  const keywords = settings.asr?.keywords ?? [];
  if (keywords.length > 0 && settings.asr?.vendor && settings.asr.vendor !== "ares") {
    errors.push({
      path: "asr.keywords",
      code: "ares_keywords_vendor",
      message: "ASR keywords are supported only when the vendor is ARES.",
    });
  }
  if (keywords.length > 128) {
    errors.push({
      path: "asr.keywords",
      code: "ares_keywords_limit",
      message: "ASR keywords support a maximum of 128 entries.",
    });
  }

  if (
    (settings.interruption?.keywords_config?.trigger_keywords?.length ?? 0) >
    128
  ) {
    errors.push({
      path: "interruption.keywords_config.trigger_keywords",
      code: "interruption_keywords_limit",
      message: "Interruption supports a maximum of 128 trigger keywords.",
    });
  }

  const startMode = settings.turn_detection?.config?.start_of_speech?.mode;
  const endMode = settings.turn_detection?.config?.end_of_speech?.mode;
  if (
    settings.enable_turn_detection &&
    (startMode === "manual" || endMode === "manual") &&
    settings.advanced_features?.enable_rtm !== true
  ) {
    errors.push({
      path: "turn_detection.config.start_of_speech.mode",
      code: "manual_turn_requires_rtm",
      message: "Manual turn detection requires RTM and the RTM data channel.",
    });
  }

  for (const server of settings.llm?.mcp_servers ?? []) {
    if (server.enabled === false) continue;
    if (!/^[A-Za-z0-9]{1,48}$/.test(server.name)) {
      errors.push({
        path: "llm.mcp_servers.name",
        code: "mcp_name",
        message: "MCP server names must contain 1–48 letters or numbers.",
      });
    }
    if (server.transport && server.transport !== "streamable_http") {
      errors.push({
        path: "llm.mcp_servers.transport",
        code: "mcp_transport",
        message: "MCP servers must use streamable_http transport.",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
