import type {
  AgentSettings,
  InterruptionConfig,
  MCPServerConfig,
  MllmTurnDetection,
} from "@/types/agora";
import { ANAM_DEFAULT_AVATAR_ID } from "@/constants/anamAvatars";
import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";

export const ENGINE_SETTINGS_SCHEMA_VERSION = 215 as const;

const PREVIOUS_ANAM_DEFAULTS = new Set([
  "30fa96d0-26c4-4e55-94a0-517025942e18",
  "edf6fdcb-acab-44b8-b974-ded72665ee26",
]);
const PREVIOUS_ELEVENLABS_DEFAULTS = new Set([
  "90ipbRoKi4CpHXvKVtl0",
  "pFZP5JQG7iQjIQuC4Bku",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneRecord(input: unknown): Record<string, unknown> {
  return isRecord(input)
    ? (JSON.parse(JSON.stringify(input)) as Record<string, unknown>)
    : {};
}

function migrateInterruption(settings: Record<string, unknown>): void {
  const turnDetection = isRecord(settings.turn_detection)
    ? settings.turn_detection
    : undefined;
  const config = turnDetection && isRecord(turnDetection.config)
    ? turnDetection.config
    : undefined;
  const start = config && isRecord(config.start_of_speech)
    ? config.start_of_speech
    : undefined;

  if (!isRecord(settings.interruption)) {
    let interruption: InterruptionConfig = {
      enable: true,
      mode: "start_of_speech",
    };

    if (start?.mode === "disabled") {
      const disabledConfig = isRecord(start.disabled_config)
        ? start.disabled_config
        : {};
      interruption = {
        enable: false,
        disabled_config: {
          strategy:
            disabledConfig.strategy === "ignored"
              ? "ignore"
              : disabledConfig.strategy === "ignore"
                ? "ignore"
                : "append",
        },
      };
    } else if (start?.mode === "keywords") {
      const keywordsConfig = isRecord(start.keywords_config)
        ? start.keywords_config
        : {};
      const triggerKeywords = Array.isArray(keywordsConfig.triggered_keywords)
        ? keywordsConfig.triggered_keywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : [];
      interruption = {
        enable: true,
        mode: "keywords",
        keywords_config: { trigger_keywords: triggerKeywords },
      };
    }

    settings.interruption = interruption;
  }

  if (start?.mode === "disabled" || start?.mode === "keywords") {
    delete config!.start_of_speech;
  }
}

function migrateMllm(settings: Record<string, unknown>): void {
  const advancedFeatures = isRecord(settings.advanced_features)
    ? settings.advanced_features
    : undefined;
  const legacyEnabled = advancedFeatures?.enable_mllm === true;
  if (advancedFeatures) delete advancedFeatures.enable_mllm;

  if (!isRecord(settings.mllm)) return;
  const mllm = settings.mllm as Record<string, unknown>;
  if (typeof mllm.enable !== "boolean") mllm.enable = legacyEnabled;
  if (typeof mllm.vendor !== "string") {
    mllm.vendor = mllm.style === "gemini" ? "gemini" : "openai";
  }
  delete mllm.style;

  if (!Array.isArray(mllm.messages) && Array.isArray(mllm.system_messages)) {
    mllm.messages = mllm.system_messages
      .filter(isRecord)
      .map((message) => ({
        type: "message",
        role: typeof message.role === "string" ? message.role : "system",
        content: [
          {
            type: "input_text",
            text: typeof message.content === "string" ? message.content : "",
          },
        ],
      }));
  }
  delete mllm.system_messages;
  delete mllm.headers;
  delete mllm.failure_message;
  delete mllm.max_history;

  if (!isRecord(mllm.turn_detection)) return;
  const legacyTurn = mllm.turn_detection;
  if (typeof legacyTurn.mode === "string") return;

  const provider = legacyTurn.provider;
  const providerConfig =
    provider === "gemini" && isRecord(legacyTurn.gemini)
      ? { ...legacyTurn.gemini }
      : isRecord(legacyTurn.openai)
        ? { ...legacyTurn.openai }
        : {};
  const legacyType = providerConfig.type;
  delete providerConfig.type;
  const mode =
    legacyType === "semantic_vad"
      ? "semantic_vad"
      : legacyType === "agora_vad"
        ? "agora_vad"
        : "server_vad";
  const configKey = `${mode}_config` as
    | "agora_vad_config"
    | "server_vad_config"
    | "semantic_vad_config";
  mllm.turn_detection = {
    mode,
    [configKey]: providerConfig,
  } satisfies MllmTurnDetection;
}

function migrateAliases(settings: Record<string, unknown>): void {
  if (isRecord(settings.llm) && typeof settings.llm.headers === "string") {
    try {
      const parsed = JSON.parse(settings.llm.headers) as unknown;
      settings.llm.headers = isRecord(parsed) ? parsed : undefined;
    } catch {
      settings.llm.headers = undefined;
    }
  }
  if (isRecord(settings.tts)) {
    if (settings.tts.vendor === "fish_audio") settings.tts.vendor = "fishaudio";
    if (settings.tts.vendor === "polly") settings.tts.vendor = "amazon";
  }
  if (isRecord(settings.asr) && settings.asr.vendor === "transcribe") {
    settings.asr.vendor = "amazon";
  }
  if (isRecord(settings.llm) && Array.isArray(settings.llm.mcp_servers)) {
    settings.llm.mcp_servers = settings.llm.mcp_servers.map((server) => {
      if (!isRecord(server)) return server;
      const migrated = { ...server } as MCPServerConfig;
      if (migrated.transport === "http" || migrated.transport === "sse") {
        migrated.transport = "streamable_http";
      }
      return migrated;
    });
  }
}

function migrateParameters(settings: Record<string, unknown>): void {
  if (!isRecord(settings.parameters)) return;
  const parameters = settings.parameters;
  if (parameters.data_channel === "rtc") parameters.data_channel = "datastream";
  if (isRecord(parameters.silence_config) && parameters.silence_config.action === "none") {
    parameters.silence_config.action = "speak";
    parameters.silence_config.timeout_ms = 0;
  }
  if (
    parameters.enable_farewell === true &&
    !isRecord(parameters.farewell_config)
  ) {
    parameters.farewell_config = { graceful_enabled: true };
  }
  delete parameters.enable_farewell;
  delete parameters.farewell_phrases;
}

function migrateTeacherMediaDefaults(
  settings: Record<string, unknown>,
  sourceSchemaVersion: number,
): void {
  if (
    sourceSchemaVersion === 0 ||
    sourceSchemaVersion >= ENGINE_SETTINGS_SCHEMA_VERSION
  ) {
    return;
  }

  const avatar = isRecord(settings.avatar) ? settings.avatar : undefined;
  if (!avatar) {
    settings.avatar = {
      enable: true,
      vendor: "anam",
      params: {
        api_key: "",
        agora_uid: "",
        avatar_id: ANAM_DEFAULT_AVATAR_ID,
        sample_rate: 24000,
        quality: "high",
        video_encoding: "H264",
      },
    };
  } else if (avatar.vendor === "anam") {
    avatar.enable = true;
    const params = isRecord(avatar.params) ? avatar.params : {};
    const avatarId = String(params.avatar_id ?? "").trim();
    if (!avatarId || PREVIOUS_ANAM_DEFAULTS.has(avatarId)) {
      params.avatar_id = ANAM_DEFAULT_AVATAR_ID;
    }
    params.sample_rate ??= 24000;
    params.quality ??= "high";
    params.video_encoding ??= "H264";
    avatar.params = params;
  }

  const tts = isRecord(settings.tts) ? settings.tts : undefined;
  if (tts?.vendor === "elevenlabs") {
    const params = isRecord(tts.params) ? tts.params : {};
    const voiceId = String(params.voice_id ?? "").trim();
    if (!voiceId || PREVIOUS_ELEVENLABS_DEFAULTS.has(voiceId)) {
      params.voice_id = ELEVENLABS_DEFAULT_VOICE_ID;
    }
    tts.params = params;
  }
}

export function migrateAgentSettings(input: unknown): AgentSettings {
  const settings = cloneRecord(input);
  const sourceSchemaVersion =
    typeof settings.schemaVersion === "number" ? settings.schemaVersion : 0;
  migrateInterruption(settings);
  migrateMllm(settings);
  migrateAliases(settings);
  migrateParameters(settings);
  migrateTeacherMediaDefaults(settings, sourceSchemaVersion);
  settings.schemaVersion = ENGINE_SETTINGS_SCHEMA_VERSION;
  return settings as unknown as AgentSettings;
}
