import type {
  ASRConfig,
  ASRVendor,
  LLMConfig,
  LLMEngineVendor,
  TTSConfig,
  TTSVendor,
} from "@/types/agora";
import {
  OPENAI_MANAGED_DEFAULT_MODEL,
  OPENAI_MANAGED_MODEL_IDS,
} from "./openAIModels";

interface ManagedProviderDefinition {
  label: string;
  defaultModel: string;
  models: readonly string[];
}

export interface ManagedMiniMaxVoice {
  value: string;
  label: string;
  language: "English" | "Hindi";
}

export const DEFAULT_MANAGED_MINIMAX_VOICE_ID =
  "English_captivating_female1";

export const MANAGED_MINIMAX_VOICES = [
  {
    value: "English_captivating_female1",
    label: "Captivating Female",
    language: "English",
  },
  {
    value: "English_Trustworth_Man",
    label: "Trustworthy Man",
    language: "English",
  },
  {
    value: "English_expressive_narrator",
    label: "Expressive Narrator",
    language: "English",
  },
  {
    value: "hindi_male_1_v2",
    label: "Trustworthy Advisor",
    language: "Hindi",
  },
  {
    value: "hindi_female_2_v1",
    label: "Tranquil Woman",
    language: "Hindi",
  },
  {
    value: "hindi_female_1_v2",
    label: "News Anchor",
    language: "Hindi",
  },
] as const satisfies readonly ManagedMiniMaxVoice[];

export const MANAGED_ASR_PROVIDERS = {
  deepgram: {
    label: "Deepgram",
    defaultModel: "nova-3",
    models: ["nova-2", "nova-3"],
  },
} as const satisfies Record<string, ManagedProviderDefinition>;

export const MANAGED_LLM_PROVIDERS = {
  openai: {
    label: "OpenAI",
    defaultModel: OPENAI_MANAGED_DEFAULT_MODEL,
    models: OPENAI_MANAGED_MODEL_IDS,
  },
} as const satisfies Record<string, ManagedProviderDefinition>;

export const MANAGED_TTS_PROVIDERS = {
  minimax: {
    label: "MiniMax",
    defaultModel: "speech-2.6-turbo",
    models: ["speech-2.6-turbo", "speech-2.8-turbo"],
  },
  openai: {
    label: "OpenAI",
    defaultModel: "tts-1",
    models: ["tts-1"],
  },
} as const satisfies Record<string, ManagedProviderDefinition>;

export type ManagedASRVendor = keyof typeof MANAGED_ASR_PROVIDERS;
export type ManagedLLMVendor = keyof typeof MANAGED_LLM_PROVIDERS;
export type ManagedTTSVendor = keyof typeof MANAGED_TTS_PROVIDERS;

function hasManagedProvider<T extends Record<string, ManagedProviderDefinition>>(
  catalog: T,
  vendor: string | undefined,
): vendor is keyof T & string {
  return Boolean(vendor && Object.prototype.hasOwnProperty.call(catalog, vendor));
}

function supportsModel(
  definition: ManagedProviderDefinition,
  model: unknown,
): model is string {
  return typeof model === "string" && definition.models.includes(model);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function supportsManagedMiniMaxVoice(value: unknown): value is string {
  return (
    typeof value === "string" &&
    MANAGED_MINIMAX_VOICES.some((voice) => voice.value === value)
  );
}

function withoutCredentials(
  params: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !(
        normalized === "key" ||
        normalized === "api_key" ||
        normalized === "authorization" ||
        normalized.endsWith("_key") ||
        normalized.endsWith("_secret")
      );
    }),
  );
}

export function isSupportedManagedASR(
  vendor: ASRVendor | string | undefined,
  model: unknown,
): boolean {
  return (
    hasManagedProvider(MANAGED_ASR_PROVIDERS, vendor) &&
    supportsModel(MANAGED_ASR_PROVIDERS[vendor], model)
  );
}

export function isSupportedManagedLLM(
  vendor: LLMEngineVendor | string | undefined,
  model: unknown,
): boolean {
  return (
    hasManagedProvider(MANAGED_LLM_PROVIDERS, vendor) &&
    supportsModel(MANAGED_LLM_PROVIDERS[vendor], model)
  );
}

export function isSupportedManagedTTS(
  vendor: TTSVendor | string | undefined,
  model: unknown,
): boolean {
  return (
    hasManagedProvider(MANAGED_TTS_PROVIDERS, vendor) &&
    supportsModel(MANAGED_TTS_PROVIDERS[vendor], model)
  );
}

export function normalizeManagedLLM(
  config: LLMConfig,
  requestedModel?: string,
): LLMConfig {
  const definition = MANAGED_LLM_PROVIDERS.openai;
  const candidateModel = requestedModel ?? config.params?.model;
  const model = supportsModel(definition, candidateModel)
    ? candidateModel
    : definition.defaultModel;

  const rest = { ...config };
  delete rest.headers;
  return {
    ...rest,
    credential_mode: "managed",
    vendor: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    api_key: "",
    style: "openai",
    params: {
      ...withoutCredentials(config.params ?? {}),
      model,
    },
  };
}

export function normalizeManagedTTS(
  config: TTSConfig,
  requestedVendor?: ManagedTTSVendor,
): TTSConfig {
  const vendor =
    requestedVendor ??
    (hasManagedProvider(MANAGED_TTS_PROVIDERS, config.vendor)
      ? config.vendor
      : "minimax");
  const definition = MANAGED_TTS_PROVIDERS[vendor];
  const currentParams = (config.params ?? {}) as Record<string, unknown>;
  const existingModel = currentParams.model;
  const model = supportsModel(definition, existingModel)
    ? existingModel
    : definition.defaultModel;
  const params =
    config.vendor === vendor ? withoutCredentials(currentParams) : {};

  if (vendor === "minimax") {
    params.url = "wss://api.minimax.io/ws/v1/t2a_v2";
    const currentVoiceSetting = isRecord(params.voice_setting)
      ? params.voice_setting
      : {};
    params.voice_setting = {
      ...currentVoiceSetting,
      voice_id: supportsManagedMiniMaxVoice(currentVoiceSetting.voice_id)
        ? currentVoiceSetting.voice_id
        : DEFAULT_MANAGED_MINIMAX_VOICE_ID,
    };
  } else {
    params.url = "https://api.openai.com/v1/audio/speech";
    params.voice =
      typeof params.voice === "string" && params.voice ? params.voice : "alloy";
  }

  const rest = { ...config };
  delete rest.headers;
  delete rest.url;
  return {
    ...rest,
    credential_mode: "managed",
    vendor,
    params: { ...params, model },
  };
}

export function normalizeManagedASR(config: ASRConfig = {}): ASRConfig {
  const definition = MANAGED_ASR_PROVIDERS.deepgram;
  const currentParams = (config.params ?? {}) as Record<string, unknown>;
  const model =
    config.vendor === "deepgram" && supportsModel(definition, currentParams.model)
      ? currentParams.model
      : definition.defaultModel;
  const language = config.language || "en-US";
  const params =
    config.vendor === "deepgram" ? withoutCredentials(currentParams) : {};

  return {
    ...config,
    credential_mode: "managed",
    vendor: "deepgram",
    language,
    keywords: undefined,
    params: {
      ...params,
      model,
      url: "wss://api.deepgram.com/v1/listen",
      language,
    },
  };
}
